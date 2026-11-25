type Slot={id:string;start:number;end:number};
type Task={id:string;completed:boolean;deleted_at:string|null;due_date:string|null;duration_minutes:number|null};
type Interval={start:number;end:number};
export function revalidateApprovedSlots(slots:readonly Slot[],tasks:readonly Task[],busy:readonly Interval[],now:number):void{
 if(!Number.isFinite(now)||!slots.length||slots.length>100)throw new Error("INVALID_APPROVAL");
 if(busy.some(b=>!Number.isFinite(b.start)||!Number.isFinite(b.end)||b.end<=b.start))throw new Error("INVALID_AVAILABILITY");
 const byId=new Map(tasks.map(t=>[t.id,t]));
 const seen=new Set<string>();
 const ordered=[...slots].sort((a,b)=>a.start-b.start);
 for(let i=0;i<ordered.length;i++){
  const s=ordered[i],t=byId.get(s.id);
  if(seen.has(s.id)||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<now||s.end<=s.start)throw new Error("STALE_APPROVAL");
  seen.add(s.id);
  if(!t||t.completed!==false||t.deleted_at!==null||t.due_date!==null)throw new Error("STALE_TASK");
  const d=t.duration_minutes;
  const minutes=typeof d==="number"&&Number.isInteger(d)&&d>0&&d<=1440?d:25;
  if(s.end-s.start!==minutes*60000)throw new Error("STALE_DURATION");
  if(i>0&&s.start<ordered[i-1].end||busy.some(b=>s.start<b.end&&s.end>b.start))throw new Error("SLOT_OCCUPIED");
 }
}
