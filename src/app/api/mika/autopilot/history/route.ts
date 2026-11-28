import {NextResponse} from "next/server";
import {authenticateRequest} from "@/lib/supabase/request-client";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 try{
  const {supabase,user,assuranceUnavailable}=await authenticateRequest(request);
  if(!user)return reply({error:"Não autenticado."},401);
  if(assuranceUnavailable)return reply({error:"Verificação de sessão indisponível."},503);
  const url=new URL(request.url),raw=url.searchParams.get("limit")??"20";
  if(!/^\d{1,3}$/.test(raw))return reply({error:"Limite inválido."},400);
  const limit=Math.min(100,Math.max(1,Number(raw)));
  const {data,error}=await supabase.from("mika_autopilot_audit").select("id,approval_id,action,event_ids,metadata,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(limit);
  if(error)return reply({error:"Não foi possível consultar o histórico."},503);
  return reply({items:data??[]});
 }catch{return reply({error:"Não foi possível consultar o histórico."},503)}
}
