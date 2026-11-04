export function weeklyPracticeReview(activity=[],now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
  const format=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day=value=>{const parts=Object.fromEntries(format.formatToParts(new Date(value)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`;};
  const shift=(date,offset)=>{const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10);};
  const seen=new Set(),rows=(Array.isArray(activity)?activity:[]).filter(row=>row&&row.action!=='examples'&&row.scope!=='examples'&&typeof row.taskId==='string'&&row.taskId&&typeof row.topic==='string'&&row.topic&&typeof row.sessionId==='string'&&row.sessionId&&Number.isFinite(Date.parse(row.createdAt))&&Date.parse(row.createdAt)<=Number(now)&&Number.isInteger(row.total)&&row.total>0&&Number.isInteger(row.passed)&&row.passed>=0&&row.passed<=row.total).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.sessionId.localeCompare(b.sessionId)).filter(row=>{const key=JSON.stringify([row.sessionId,row.taskId,row.createdAt]);if(seen.has(key))return false;seen.add(key);return true;}).map(row=>({...row,date:day(row.createdAt)}));
  const today=day(now);
  function period(start,end){
    const selected=rows.filter(row=>row.date>=start&&row.date<=end),latest=new Map();for(const row of selected)latest.set(row.taskId,row);
    const questions=[...latest.values()],topics=[...new Set(selected.map(row=>row.topic))].map(topic=>{
      const submissions=selected.filter(row=>row.topic===topic),items=questions.filter(row=>row.topic===topic).sort((a,b)=>Number(a.passed===a.total)-Number(b.passed===b.total)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
      const passing=items.filter(row=>row.passed===row.total).length;
      return {topic,questions:items.length,passing,needsReview:items.length-passing,submissions:submissions.length,activeDays:new Set(submissions.map(row=>row.date)).size,sessionId:items[0]?.sessionId||submissions.at(-1)?.sessionId};
    }).sort((a,b)=>b.needsReview-a.needsReview||b.questions-a.questions||a.topic.localeCompare(b.topic));
    return {start,end,questions:questions.length,passing:questions.filter(row=>row.passed===row.total).length,needsReview:questions.filter(row=>row.passed<row.total).length,submissions:selected.length,activeDays:new Set(selected.map(row=>row.date)).size,topics};
  }
  const current=period(shift(today,-6),today),previous=period(shift(today,-13),shift(today,-7));
  return {current,previous,delta:{questions:current.questions-previous.questions,submissions:current.submissions-previous.submissions,activeDays:current.activeDays-previous.activeDays}};
}
