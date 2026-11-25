/** Read-only free-slot calculation. All timestamps are epoch milliseconds. */
export type TimeInterval = { start: number; end: number };
export function findFreeSlots(window: TimeInterval, busy: readonly TimeInterval[], minimumMinutes=15): TimeInterval[] {
  const valid=(x:TimeInterval)=>Number.isSafeInteger(x.start)&&Number.isSafeInteger(x.end)&&x.end>x.start;
  if(!valid(window)||!Number.isInteger(minimumMinutes)||minimumMinutes<1||minimumMinutes>1440||busy.length>1000||busy.some(x=>!valid(x))) throw new Error("invalid_schedule");
  const sorted=busy.filter(x=>x.end>window.start&&x.start<window.end).map(x=>({start:Math.max(x.start,window.start),end:Math.min(x.end,window.end)})).sort((a,b)=>a.start-b.start);
  const free:TimeInterval[]=[];let cursor=window.start;
  for(const x of sorted){if(x.start-cursor>=minimumMinutes*60000)free.push({start:cursor,end:x.start});cursor=Math.max(cursor,x.end);}
  if(window.end-cursor>=minimumMinutes*60000)free.push({start:cursor,end:window.end});
  return free;
}
