import { t } from './i18n.mjs';
const display=value=>value===undefined?t('Not recorded'):JSON.stringify(value);
const outcome=row=>row.status==='passed'?t('Supplied expectation matched'):row.status==='failed'?t('Return-value mismatch observed'):t('Execution error observed');

export function buildWalkthrough(record,caseIndex,sourceLabel='Saved verification run'){
  const item=record?.submission?.cases?.[caseIndex],result=record?.evidence?.results?.find(row=>row.index===caseIndex);
  if(!Number.isInteger(caseIndex) || !item || !result)throw new Error('Choose an existing completed test.');
  if(!Array.isArray(result.trace) || !result.trace.length)throw new Error('No captured function events are available for this test. No execution path can be replayed.');
  const snapshot=JSON.parse(JSON.stringify(record)),submission=snapshot.submission,row=snapshot.evidence.results.find(result=>result.index===caseIndex),events=row.trace;
  const call=`${submission.functionName}(${[...item.args.map(value=>display(value)),...Object.entries(item.kwargs || {}).map(([key,value])=>`${key}=${display(value)}`)].join(', ')})`;
  const summary={call,expected:display(item.expected),actual:row.status==='error'?row.error:display(row.actual),status:row.status,outcome:outcome(row)};
  const context={sourceId:snapshot.evidence.id || 'Not recorded',sourceLabel,createdAt:snapshot.evidence.createdAt || 'Not recorded',caseIndex,code:submission.code,intent:submission.intent || '',summary,partial:Boolean(row.traceTruncated),traceNote:row.traceNote || 'Captured variable previews are bounded. Events describe recorded execution only.',timingNote:'Replay pacing is instructional, not measured execution timing.'};
  const frames=[{kind:'intro',title:'1. Read the contract and reproduce the input',caption:'Compare the supplied expectation with the recorded outcome. Before stepping, predict what this implementation will do for this exact input.',line:events[0].line,variables:{},changes:[]}];
  events.forEach((event,index)=>{
    const previous=events[index-1],sameContext=previous && previous.function===event.function && event.event!=='call';
    const changes=sameContext?Object.entries(event.variables || {}).filter(([key,value])=>Object.hasOwn(previous.variables || {},key) && previous.variables[key]!==value).map(([name,value])=>({name,before:previous.variables[name],after:value})):[];
    const title=event.event==='line'?t('Before line {0} executes',event.line):event.event==='call'?t('Enter {0}',event.function):event.event==='exception'?t('Exception captured at line {0}',event.line):t('Return / unwind event at line {0}',event.line);
    const caption=event.event==='line'?t('This snapshot is BEFORE the highlighted line executes. Read the captured locals, predict the next step, then compare with the next recorded event.'):event.event==='call'?t('Python captured a function call. Identify the input previews and connect them to the supplied test before moving forward.'):event.event==='exception'?t('{0} was raised here. It may be caught later; this event alone does not establish a failed test.',event.exception || t('An exception')):t('A return or exception-unwind event was captured. Its value preview alone does not establish success; use the completed test outcome.');
    frames.push({kind:'event',eventIndex:index,event:event.event,functionName:event.function,title,caption,line:event.line,variables:event.variables || {},changes,...(event.exception?{exception:event.exception}:{}),...(Object.hasOwn(event,'value')?{value:event.value}:{})});
  });
  frames.push({kind:'outcome',title:`3. ${outcome(row)}`,caption:row.status==='passed'?'This input matched its supplied expectation. Ask which other inputs remain untested; one passing example does not prove correctness.':'Use this exact input to reproduce the observation. Explain one hypothesis, make one deliberate repair, and rerun unchanged expectations. This replay does not apply or verify a repair.',line:events.at(-1).line,variables:{},changes:[]});
  return {context,frames,capturedEvents:events.length};
}

export function videoStoryboard(deck,maxFrames=20){
  if(!Number.isInteger(maxFrames) || maxFrames<3 || maxFrames>30)throw new Error('Choose a video frame budget from 3 to 30.');
  const events=deck.frames.filter(frame=>frame.kind==='event'),selected=events.slice(0,maxFrames-2),excerpt=selected.length<events.length;
  return {context:{...deck.context,videoExcerpt:excerpt,videoNote:excerpt?`Video excerpt: first ${selected.length}/${events.length} captured events; later events are omitted. Final outcome is from the completed run.`:`All ${events.length} captured events are included.`,videoSecondsPerFrame:2},frames:[deck.frames[0],...selected,deck.frames.at(-1)],capturedEvents:deck.capturedEvents};
}
