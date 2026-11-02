const FROM = "MYRYRA Support <support@myryra.com>";
type SupportNotice = { to:string; subject:string; ticketId:string; message:string };
export async function sendSupportEmail(notice:SupportNotice):Promise<{sent:boolean;reason?:string}> {
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey) return {sent:false,reason:"RESEND_API_KEY não configurada"};
  const url=process.env.NEXT_PUBLIC_SITE_URL || "https://myryra.com";
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({from:FROM,to:[notice.to],subject:notice.subject,text:`${notice.message}\n\nProtocolo: ${notice.ticketId.slice(0,8).toUpperCase()}\nAcompanhe seu chamado entrando na MYRYRA: ${url}\n\nEsta mensagem não solicita dados bancários ou senhas.`})
  });
  if(!response.ok) return {sent:false,reason:`Provedor retornou HTTP ${response.status}`};
  return {sent:true};
}
