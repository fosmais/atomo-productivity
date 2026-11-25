import {createHash} from "node:crypto";
import {createSupabaseAdmin} from "@/lib/supabase/admin";
import {NextResponse} from "next/server";
import {authenticateRequest} from "@/lib/supabase/request-client";
import {checkConciergeRateLimit} from "@/lib/rate-limit";
import {verifyApprovalProposal} from "@/lib/mika/autopilot-approval-token";
import {GET as getGoogleEvents} from "@/app/api/google/events/route";
import {consolidateBusyIntervals} from "@/lib/mika/autopilot-google-busy";
import {revalidateApprovedSlots} from "@/lib/mika/autopilot-revalidate";
import {selectApprovedSlots} from "@/lib/mika/autopilot-approval";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 try{
  const {user,mfaRequired,assuranceUnavailable}=await authenticateRequest(request);
  if(!user)return reply({error:"Não autenticado."},401);
  if(assuranceUnavailable)return reply({error:"Verificação de sessão indisponível."},503);
  if(mfaRequired)return reply({error:"Segundo fator obrigatório."},403);
  const limit=await checkConciergeRateLimit(user.id);
  if(!limit.allowed)return reply({error:"Muitas solicitações."},429);
  if(!(request.headers.get("content-type")??"").toLowerCase().startsWith("application/json"))return reply({error:"Envie JSON."},415);
  const raw=await request.text();
  if(raw.length>80000)return reply({error:"Requisição muito grande."},413);
  let body;
  try{body=JSON.parse(raw)}catch{return reply({error:"JSON inválido."},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.approvalToken!=="string"||!Array.isArray(body.approvedIds))return reply({error:"Seleção inválida."},400);
  if(Buffer.byteLength(process.env.MIKA_AUTOPILOT_APPROVAL_SECRET??"")<32)return reply({error:"Autorização indisponível."},503);
  try{
   const now=Date.now();
   const proposal=verifyApprovalProposal(body.approvalToken,user.id,now);
   const slots=selectApprovedSlots(proposal.slots,body.approvedIds,now);
   const first=Math.min(...slots.map(s=>s.start)),last=Math.max(...slots.map(s=>s.end));
   if(last-first>31*86400000)return reply({error:"Período de aprovação muito amplo."},422);
   const [tasksResult,eventsResult,prefsResult]=await Promise.all([
    (await authenticateRequest(request)).supabase.from("tasks").select("id,completed,deleted_at,due_date,duration_minutes").eq("user_id",user.id).in("id",slots.map(s=>s.id)),
    (await authenticateRequest(request)).supabase.from("events").select("starts_at,ends_at,blocks_time").eq("user_id",user.id).is("deleted_at",null).lt("starts_at",new Date(last).toISOString()).gt("ends_at",new Date(first).toISOString()),
    (await authenticateRequest(request)).supabase.from("planning_preferences").select("time_zone").eq("user_id",user.id).maybeSingle()
   ]);
   if(tasksResult.error||eventsResult.error||prefsResult.error)return reply({error:"Não foi possível revalidar sua agenda."},503);
   const googleUrl=new URL(request.url);googleUrl.pathname="/api/google/events";googleUrl.search="";
   googleUrl.searchParams.set("timeMin",new Date(first).toISOString());googleUrl.searchParams.set("timeMax",new Date(last).toISOString());
   const googleResponse=await getGoogleEvents(new Request(googleUrl,{headers:request.headers}));
   if(!googleResponse.ok)return reply({error:"Não foi possível confirmar a disponibilidade do Google Calendar."},503);
   const external=await googleResponse.json();
   const internal=(eventsResult.data??[]).filter(e=>e.blocks_time!==false).map(e=>({start:Date.parse(e.starts_at),end:Date.parse(e.ends_at)}));
   const busy=consolidateBusyIntervals(internal,external,prefsResult.data?.time_zone??"America/Sao_Paulo");
   try{revalidateApprovedSlots(slots,tasksResult.data??[],busy,now);}catch{return reply({error:"A agenda ou as tarefas mudaram. Gere novas sugestões antes de aprovar."},409);}
   if(process.env.MIKA_AUTOPILOT_PERSIST_ENABLED!=="true")return reply({mode:"validation_only",validated:true,persisted:false,executed:false,slots});
   const digest=createHash("sha256").update(body.approvalToken.split(".")[0]).digest("hex");
   const admin=createSupabaseAdmin();
   const {data,error}=await admin.from("mika_autopilot_approvals").insert({user_id:user.id,proposal_digest:digest,slots,expires_at:new Date(proposal.expiresAt).toISOString()}).select("id").single();
   if(error?.code==="23505")return reply({error:"Proposta já utilizada."},409);
   if(error||!data)return reply({error:"Não foi possível registrar a autorização."},503);
   return reply({mode:"approval_only",validated:true,persisted:true,executed:false,approvalId:data.id,slots});
  }catch{return reply({error:"Proposta inválida ou expirada. Gere novas sugestões."},400)}
 }catch{return reply({error:"Não foi possível validar a seleção."},503)}
}
