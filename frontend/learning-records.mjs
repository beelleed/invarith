// Calendar dates use the learner's browser time zone, not the server's clock zone.
export function reviewSchedule(summary={},now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
  const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>{const parts=Object.fromEntries(format.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
  const shift=(date,days)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
  const today=day(now),contracts=new Map((summary.topics||[]).flatMap(row=>(row.contracts||[]).map(item=>[item.id,{...item,topic:row.id}]))),groups=new Map();
  const rows=(summary.activity||[]).filter(row=>row.taskId&&row.sessionId&&contracts.has(row.taskId)&&Number.isFinite(Date.parse(row.createdAt))&&Date.parse(row.createdAt)<=Number(now)&&Number.isInteger(row.total)&&row.total>0&&Number.isInteger(row.passed)&&row.passed>=0&&row.passed<=row.total).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  for(const row of rows){
    const date=day(row.createdAt),state=groups.get(row.taskId)||{streak:0,lastCreditDay:null};
    if(row.passed!==row.total){state.streak=0;state.lastCreditDay=null;}
    else if(state.lastCreditDay!==date){state.streak=Math.min(5,state.streak+1);state.lastCreditDay=date;}
    state.latest=row;groups.set(row.taskId,state);
  }
  const items=[...groups].map(([id,{streak,latest}])=>{
    const failed=latest.passed!==latest.total,interval=failed?0:[1,3,7,14,30][Math.max(0,streak-1)];
    const dueDate=shift(day(latest.createdAt),interval);
    return {...contracts.get(id),latest,failed,interval,stage:streak,dueDate,due:dueDate<=today};
  }).sort((a,b)=>Number(b.failed)-Number(a.failed)||a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
  return {today,due:items.filter(item=>item.due),upcoming:items.filter(item=>!item.due)};
}

export function learningRecords(activity=[],now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
  const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>{const parts=Object.fromEntries(format.formatToParts(new Date(value)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
  const today=day(now),first=new Map(),daily=new Map();
  for(const row of [...activity].filter(r=>Number.isFinite(Date.parse(r.createdAt))).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))){
    const date=day(row.createdAt);if(date>today)continue;
    if(!first.has(row.taskId))first.set(row.taskId,date);
    if(!daily.has(date))daily.set(date,new Map());
    daily.get(date).set(row.taskId,{...row,isReview:row.reviewOfAssessment===true||row.reviewOfPractice===true||daily.get(date).get(row.taskId)?.isReview===true||first.get(row.taskId)!==date});
  }
  const dates=Array.from({length:14},(_,i)=>{const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-13+i);return date.toISOString().slice(0,10);});
  const days=dates.map(date=>({date,count:daily.get(date)?.size||0}));
  const rows=[...(daily.get(today)?.values()||[])];
  return {today,days,activeDays:daily.size,todayRows:rows,newToday:rows.filter(r=>!r.isReview).length,reviewToday:rows.filter(r=>r.isReview).length};
}
