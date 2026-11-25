import "server-only";
import {createHmac,timingSafeEqual} from "node:crypto";
type Slot={id:string;start:number;end:number;requiresApproval:true};
type Proposal={userId:string;expiresAt:number;slots:Slot[]};
function secret(){const key=process.env.MIKA_AUTOPILOT_APPROVAL_SECRET;if(!key||Buffer.byteLength(key)<32)throw new Error("Autorização indisponível.");return key;}
function signature(payload:string){return createHmac("sha256",secret()).update("mika-autopilot-v1:"+payload).digest();}
export function signApprovalProposal(userId:string,slots:Slot[],now=Date.now()){
 if(!userId||!Number.isFinite(now)||slots.length>100)throw new Error("Proposta inválida.");
 const payload=Buffer.from(JSON.stringify({userId,expiresAt:now+5*60000,slots:slots.map(({id,start,end,requiresApproval})=>({id,start,end,requiresApproval}))})).toString("base64url");
 return payload+"."+signature(payload).toString("base64url");
}
export function verifyApprovalProposal(token:string,userId:string,now=Date.now()):Proposal{
 if(typeof token!=="string"||token.length>65536||!Number.isFinite(now))throw new Error("Proposta inválida.");
 const parts=token.split(".");
 if(parts.length!==2||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))throw new Error("Proposta inválida.");
 const [payload,mac]=parts,expected=signature(payload),actual=Buffer.from(mac,"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error("Proposta inválida.");
 const data=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as Proposal;
 if(data.userId!==userId||!Number.isFinite(data.expiresAt)||data.expiresAt<=now||!Array.isArray(data.slots)||data.slots.length>100)throw new Error("Proposta inválida ou expirada.");
 return data;
}
