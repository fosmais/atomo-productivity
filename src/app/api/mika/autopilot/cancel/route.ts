import {NextResponse} from "next/server";
import {authenticateRequest} from "@/lib/supabase/request-client";
import {checkConciergeRateLimit} from "@/lib/rate-limit";
import {createSupabaseAdmin} from "@/lib/supabase/admin";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 try{
  const {user,mfaRequired,assuranceUnavailable}=await authenticateRequest(request);
  if(!user)return reply({error:"Não autenticado."},401);
  if(assuranceUnavailable)return reply({error:"Verificação de sessão indisponível."},503);
  if(mfaRequired)return reply({error:"Segundo fator obrigatório."},403);
  if(process.env.MIKA_AUTOPILOT_PERSIST_ENABLED!=="true"||process.env.VERCEL_ENV!=="preview"||new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??"https://invalid.local").hostname!=="sdwguqyjuvuamfiingsp.supabase.co")return reply({error:"Cancelamento indisponível."},503);
  const limit=await checkConciergeRateLimit(user.id);
  if(!limit.allowed)return reply({error:"Muitas solicitações."},429);
  if(!(request.headers.get("content-type")??"").toLowerCase().startsWith("application/json"))return reply({error:"Envie JSON."},415);
  const raw=await request.text();if(raw.length>4096)return reply({error:"Requisição muito grande."},413);
  let body;try{body=JSON.parse(raw)}catch{return reply({error:"JSON inválido."},400)}
  if(!body||typeof body!=="object"||Array.isArray(body)||typeof body.approvalId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.approvalId))return reply({error:"Autorização inválida."},400);
  const {error}=await createSupabaseAdmin().rpc("cancel_mika_autopilot_approval",{p_approval_id:body.approvalId,p_user_id:user.id});
  if(error?.code==="P0002")return reply({error:"Autorização não encontrada."},404);
  if(error?.code==="P0001")return reply({error:"A autorização não está pendente."},409);
  if(error)return reply({error:"Não foi possível cancelar."},503);
  return reply({cancelled:true});
 }catch{return reply({error:"Não foi possível cancelar."},503)}
}
