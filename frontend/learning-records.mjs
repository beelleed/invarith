// Calendar dates use the learner's browser time zone, not the server's clock zone.
export function learningRecords(activity=[],now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
  const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>{const parts=Object.fromEntries(format.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
  const today=day(now),first=new Map(),daily=new Map();
  for(const row of [...activity].filter(r=>Number.isFinite(Date.parse(r.createdAt))).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))){
    const date=day(row.createdAt);if(date>today)continue;
    if(!first.has(row.taskId))first.set(row.taskId,date);
    if(!daily.has(date))daily.set(date,new Map());
    daily.get(date).set(row.taskId,{...row,isReview:row.reviewOfAssessment===true||daily.get(date).get(row.taskId)?.isReview===true||first.get(row.taskId)!==date});
  }
  const dates=Array.from({length:14},(_,i)=>{const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-13+i);return date.toISOString().slice(0,10);});
  const days=dates.map(date=>({date,count:daily.get(date)?.size||0}));
  const rows=[...(daily.get(today)?.values()||[])];
  return {today,days,activeDays:daily.size,todayRows:rows,newToday:rows.filter(r=>!r.isReview).length,reviewToday:rows.filter(r=>r.isReview).length};
}
