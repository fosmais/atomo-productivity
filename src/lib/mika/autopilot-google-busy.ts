import { TZDate } from "@date-fns/tz";
type ExternalEvent = { start:string|null; end:string|null; calendarTimeZone?:string|null; status?:string|null; transparency?:string|null; selfResponseStatus?:string|null };
function parse(value:string|null,zone:string):number {
  if(!value) return NaN;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)){
    const [y,m,d]=value.split("-").map(Number);
    const date=new TZDate(y,m-1,d,0,0,0,zone);
    return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date.getTime():NaN;
  }
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
}
export function externalBusyIntervals(events:readonly ExternalEvent[],fallbackZone:string){
  return events.flatMap(event=>{
    if(event.status==="cancelled"||event.transparency==="transparent"||event.selfResponseStatus==="declined")return [];
    const zone=event.calendarTimeZone||fallbackZone;
    const start=parse(event.start,zone),end=parse(event.end,zone);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error("Disponibilidade externa inválida.");
    return [{start,end}];
  });
}
