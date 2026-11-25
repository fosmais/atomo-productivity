type Slot={id:string;start:number;end:number;requiresApproval:true};
export function selectApprovedSlots(suggestions:readonly Slot[],approvedIds:readonly string[],now:number):Slot[]{
 if(!Number.isFinite(now)||!Array.isArray(approvedIds)||approvedIds.length<1||approvedIds.length>100||approvedIds.some(id=>typeof id!=="string"||!id.trim())||new Set(approvedIds).size!==approvedIds.length)throw new Error("Seleção inválida.");
 const byId=new Map(suggestions.map(s=>[s.id,s]));
 if(byId.size!==suggestions.length)throw new Error("Sugestões duplicadas.");
 const selected=approvedIds.map(id=>{
  const slot=byId.get(id);
  if(!slot||slot.requiresApproval!==true||!Number.isFinite(slot.start)||!Number.isFinite(slot.end)||slot.start<now||slot.end<=slot.start)throw new Error("Sugestão inválida ou expirada.");
  return {...slot};
 }).sort((a,b)=>a.start-b.start);
 for(let i=1;i<selected.length;i++)if(selected[i].start<selected[i-1].end)throw new Error("Sugestões conflitantes.");
 return selected;
}
