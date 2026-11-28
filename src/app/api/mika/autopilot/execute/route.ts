import {NextResponse} from "next/server";
import {authenticateRequest} from "@/lib/supabase/request-client";
import {checkConciergeRateLimit} from "@/lib/rate-limit";
import {createSupabaseAdmin} from "@/lib/supabase/admin";
import {GET as getGoogleEvents} from "@/app/api/google/events/route";
import {consolidateBusyIntervals} from "@/lib/mika/autopilot-google-busy";
import {revalidateApprovedSlots} from "@/lib/mika/autopilot-revalidate";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 try{
  const {supabase,user,mfaRequired,assuranceUnavailable}=await authenticateRequest(request);
  if(!user)return reply({error:"Não autenticado."},401);
  if(assuranceUnavailable)return reply({error:"Verificação de sessão indisponível."},503);
  if(mfaRequired)return reply({error:"Segundo fator obrigatório."},403);
  if(process.env.MIKA_AUTOPILOT_EXECUTION_ENABLED!=="true")return reply({error:"Execução ainda não habilitada."},503);
  if(process.env.VERCEL_ENV!=="preview"||new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??"https://invalid.local").hostname!=="sdwguqyjuvuamfiingsp.supabase.co")return reply({error:"Execução disponível somente na homologação autorizada."},503);
  const limit=await checkConciergeRateLimit(user.id);
  if(!limit.allowed)return reply({error:"Muitas solicitações."},429);
  if(!(request.headers.get("content-type")??"").toLowerCase().startsWith("application/json"))return reply({error:"Envie JSON."},415);
  const raw=await request.text();if(raw.length>4096)return reply({error:"Requisição muito grande."},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:"JSON inválido."},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.approvalId!=="string"||!/^[0-9a-f-]{36}$/i.test(body.approvalId))return reply({error:"Autorização inválida."},400);
  const admin=createSupabaseAdmin();
  const {data:approval,error:approvalError}=await admin.from("mika_autopilot_approvals").select("id,user_id,slots,expires_at,execution_status,executed_event_ids").eq("id",body.approvalId).eq("user_id",user.id).maybeSingle();
  if(approvalError)return reply({error:"Não foi possível consultar a autorização."},503);
  if(!approval)return reply({error:"Autorização não encontrada."},404);
  if(approval.execution_status==="executed")return reply({executed:true,eventIds:approval.executed_event_ids??[],idempotent:true});
  if(approval.execution_status!=="pending")return reply({error:"A autorização não está pendente."},409);
  if(approval.expires_at<=new Date().toISOString())return reply({error:"Autorização expirada."},409);
  const slots=approval.slots as Array<{id:string;start:number;end:number}>;
  if(!Array.isArray(slots)||!slots.length||slots.length>100||slots.some(s=>!s||typeof s.id!=="string"||!Number.isFinite(s.start)||!Number.isFinite(s.end)))return reply({error:"Conteúdo da autorização inválido."},409);
  const first=Math.min(...slots.map(s=>s.start)),last=Math.max(...slots.map(s=>s.end));
  const [tasksResult,eventsResult,prefsResult]=await Promise.all([
   supabase.from("tasks").select("id,completed,deleted_at,due_date,duration_minutes").eq("user_id",user.id).in("id",slots.map(s=>s.id)),
   supabase.from("events").select("starts_at,ends_at,blocks_time").eq("user_id",user.id).is("deleted_at",null).lt("starts_at",new Date(last).toISOString()).gt("ends_at",new Date(first).toISOString()),
   supabase.from("planning_preferences").select("time_zone").eq("user_id",user.id).maybeSingle()
  ]);
  if(tasksResult.error||eventsResult.error||prefsResult.error)return reply({error:"Não foi possível revalidar a agenda."},503);
  const googleUrl=new URL(request.url);googleUrl.pathname="/api/google/events";googleUrl.search="";
  googleUrl.searchParams.set("timeMin",new Date(first).toISOString());googleUrl.searchParams.set("timeMax",new Date(last).toISOString());
  const googleResponse=await getGoogleEvents(new Request(googleUrl,{headers:request.headers}));
  if(!googleResponse.ok)return reply({error:"Não foi possível confirmar o Google Calendar. Nenhum compromisso foi criado."},503);
  const external=await googleResponse.json();
  const internal=(eventsResult.data??[]).filter(e=>e.blocks_time===true).map(e=>({start:Date.parse(e.starts_at),end:Date.parse(e.ends_at)}));
  const busy=consolidateBusyIntervals(internal,external,prefsResult.data?.time_zone??"America/Sao_Paulo");
  try{revalidateApprovedSlots(slots,tasksResult.data??[],busy,Date.now());}catch{return reply({error:"A agenda mudou. Gere novas sugestões e aprove novamente."},409);}
  const {data:execution,error:executionError}=await admin.rpc("execute_mika_autopilot_approval",{p_approval_id:approval.id,p_user_id:user.id});
  if(executionError)return reply({error:"A execução foi bloqueada. Nenhum compromisso foi confirmado.",code:executionError.code??"EXECUTION_FAILED"},409);
  const eventIds=Array.isArray(execution?.[0]?.event_ids)?execution[0].event_ids:[];
  return reply({executed:true,eventIds,idempotent:false});
 }catch{return reply({error:"Não foi possível executar a autorização."},503)}
}
