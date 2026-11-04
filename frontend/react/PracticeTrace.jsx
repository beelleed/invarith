import {labelSeparator} from '../i18n.mjs';
import {formatDateTime} from '../date-format.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {TraceChallenge} from './TraceChallenge.jsx';
const value=text=>typeof text==='string'?text:JSON.stringify(text,null,2)??t('No return value');
const output=text=>JSON.stringify(text,null,2)??t('No return value');
export function PracticeTrace({session,code,result,busy,onBusy,customCase=null}){
  const [replay,setReplay]=useState(null),[step,setStep]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(''),[view,setView]=useState('explore');
  const alive=useRef(true),requesting=useRef(false),controller=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const trace=async()=>{if(busy||requesting.current)return;requesting.current=true;setLoading(true);setError('');onBusy(true);const refresh=Boolean(replay);controller.current=new AbortController();
    try{const response=await fetch(customCase?'/api/practice/custom-trace':'/api/practice/trace',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(180000)]),body:JSON.stringify({id:session.id,code,...(customCase?{revision:session.customTests.revision,runId:result.id,caseId:customCase.id}:{}),action:result.scope==='hidden_cases'?'submit':'examples',createdAt:result.createdAt,refresh})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not replay this failure.');if(alive.current){setReplay(data);setStep(0);}}
    catch(e){if(alive.current)setError(t(e.message));}finally{requesting.current=false;if(alive.current)setLoading(false);onBusy(false);}
  };
  const events=replay?.events||[],event=events[Math.min(step,events.length-1)],lines=replay?.code.split('\n')||[],start=event?Math.max(0,event.line-11):0,end=event?Math.min(lines.length,event.line+10):0;
  const ready=Number.isFinite(Date.parse(result.createdAt));
  return <section className="practice-trace" aria-label={t(customCase?'Trace this custom input':'Trace this failing input')}><header><div><h4>{t(customCase?'Follow your custom input':'Follow the failing input')}</h4><p>{t(customCase?'Inspect the actual execution of your input. Expected values are still your own.':'Replay one observed failure and inspect what Python actually executed.')}</p></div><button className="secondary-button" disabled={busy||loading||!ready} onClick={()=>void trace()}>{t(loading?'Replaying in Python…':replay?'Run a new replay · No AI':customCase?'Trace my input · No AI':'Trace this failure · No AI')}</button></header>
    {!ready&&<p>{t('Run tests again to trace this result.')}</p>}{error&&<p role="alert">{error}</p>}
    {replay&&<><p className="practice-trace-outcome" role="status">{t(replay.reproduced?(customCase?'This replay matches your saved custom-test result.':'The observed failure was reproduced.'):'This replay differs from the original result. Inspect this execution separately.')}</p><div className="practice-trace-summary"><span>{t('Expected')}{labelSeparator}<code>{output(replay.expected)}</code></span><span>{t('Replay result')}{labelSeparator}<code>{replay.status==='error'?replay.error:output(replay.actual)}</code></span><small>{t(replay.cached?'Saved replay':'New Python replay')} · {formatDateTime(replay.createdAt)}</small></div>
      {loading&&<p role="status">{t('Running a new replay. The previous replay remains shown until it finishes.')}</p>}
      <nav className="trace-challenge-tabs" aria-label={t('Replay practice mode')}>{[['explore','Explore execution'],['quiz','Predict next state']].map(([id,label])=><button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{t(label)}</button>)}</nav>
      <div hidden={view!=='quiz'}><TraceChallenge key={replay.createdAt} replay={replay}/></div>
      <div hidden={view!=='explore'}>
      {events.length>0?<><div className="practice-trace-controls"><button className="text-button" disabled={step===0} onClick={()=>setStep(index=>Math.max(0,index-1))}>{t('Previous step')}</button><label>{t('Step {0} of {1}',step+1,events.length)}<input aria-label={t('Choose trace step')} type="range" min="0" max={events.length-1} value={step} onChange={e=>setStep(Number(e.target.value))}/></label><button className="text-button" disabled={step===events.length-1} onClick={()=>setStep(index=>Math.min(events.length-1,index+1))}>{t('Next step')}</button></div><div className="practice-trace-panes"><div className="practice-trace-source" aria-label={t('Submitted source with current execution line')}>{lines.slice(start,end).map((line,index)=><div key={start+index} className={start+index+1===event.line?'is-current':''}><span>{start+index+1}</span><code>{line||' '}</code></div>)}</div><div className="practice-trace-variables"><h5>{t(event.event==='line'?'Before this line executes':event.event==='exception'?'Exception raised · it may be caught later':event.event==='return'?'Return event · an exception may also unwind a frame':'Function entered')}</h5><p>{event.function} · {t('Line {0}',event.line)}</p>{event.exception&&<p>{t('Raised: {0}',event.exception)}</p>}{Object.hasOwn(event,'value')&&<p>{t('Returned/unwind value: {0}',event.value)}</p>}<table><tbody>{Object.entries(event.variables||{}).slice(0,8).map(([name,preview])=><tr key={name}><th>{name}</th><td>{value(preview)}</td></tr>)}</tbody></table>{!Object.keys(event.variables||{}).length&&<p>{t('No local variables captured at this step.')}</p>}</div></div></>:<p>{t('No function events were captured. The replay result above is still the observed outcome.')}</p>}
      </div>
      {replay.truncated&&<p className="practice-trace-limit" role="status">{t('Partial trace: later events were not captured.')}</p>}
      <small className="practice-trace-note">{t('Line events show state before execution. Variable previews are abbreviated. This replay does not change your submitted results or solution history.')}</small>
    </>}
  </section>;
}
