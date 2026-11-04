import {formatRatio} from '../display-format.mjs';
import {labelSeparator} from '../i18n.mjs';
import {formatDateTime} from '../date-format.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {canonical} from '../evidence-tools.mjs';
const output=value=>JSON.stringify(value)??t('No return value');
export function PracticeRegressions({session,code,result,busy,onBusy,onSession}){
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[phase,setPhase]=useState(''),[stale,setStale]=useState(false),alive=useRef(true),locked=useRef(false),controller=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const group=session.regressions||{revision:0,cases:[],lastRun:null},compatible=group.cases.filter(c=>c.compatible),failure=result?.firstFailure;
  const already=failure&&compatible.some(c=>canonical(c.args)===canonical(failure.args)&&canonical(c.expected)===canonical(failure.expected));
  const checked=!stale&&group.lastRun?.compatible&&group.lastRun.revision===group.revision&&group.lastRun.code===code?group.lastRun:null;
  const act=async(operation,caseId)=>{if(busy||locked.current)return;locked.current=true;onBusy(true);setPhase(operation);setError('');setNotice('');controller.current=new AbortController();
    try{const body={id:session.id,revision:group.revision,operation,...(operation==='capture'?{code,action:result.scope==='hidden_cases'?'submit':'examples',createdAt:result.createdAt}:operation==='run'?{code}:{caseId})};const response=await fetch('/api/practice/regressions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(180000)])});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Could not update saved cases.'),{status:response.status});if(alive.current){setStale(false);onSession(value);setNotice(t(operation==='capture'?'Failing case saved.':operation==='remove'?'Saved case removed.':'Saved cases checked. Submit to hidden tests for the full result.'));}}
    catch(e){if(alive.current){if(e.status===409)setStale(true);setError(t(e.message));}}finally{locked.current=false;if(alive.current)setPhase('');onBusy(false);}
  };
  const reload=async()=>{if(busy||locked.current)return;locked.current=true;setError('');try{const response=await fetch('/api/practice/'+session.id,{signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Could not update saved cases.');if(alive.current){setStale(false);onSession(value);}}catch(e){if(alive.current)setError(t(e.message));}finally{locked.current=false;}};
  if(!failure&&!group.cases.length)return null;
  return <section className="practice-regressions" aria-label={t('My regression cases')}><header><div><h4>{t('Keep this bug from coming back.')}</h4><p>{t('Save an observed failing input, then check your next draft against it.')}</p></div>{failure&&<button className="secondary-button" disabled={busy||Boolean(already)||group.cases.length>=10||!Number.isFinite(Date.parse(result.createdAt))} onClick={()=>void act('capture')}>{t(phase==='capture'?'Saving case…':already?'This failure is already saved':'Save this failing case · No AI')}</button>}</header>
    {error&&<p role="alert">{error} <button className="text-button" disabled={busy} onClick={()=>void reload()}>{t('Reload saved cases')}</button></p>}{notice&&<p role="status">{notice}</p>}
    {failure&&!Number.isFinite(Date.parse(result.createdAt))&&<p>{t('Run tests again to save this observed failure.')}</p>}
    {group.cases.length>0&&<><div className="practice-regression-toolbar"><span>{t('{0} saved cases · {1} ready to run',group.cases.length,compatible.length)}</span><button className="secondary-button" disabled={busy||!compatible.length||!code.trim()} onClick={()=>void act('run')}>{t(phase==='run'?'Checking saved cases…':'Run {0} saved cases · No AI',compatible.length)}</button></div>
      {checked&&<p className="practice-regression-summary" role="status">{t('Saved-case result: {0} / {1}',checked.passed,checked.total)} · {formatDateTime(checked.createdAt)}</p>}
      <ol className="practice-regression-list">{group.cases.map((item,index)=>{const outcome=checked?.results.find(row=>row.caseId===item.id);return <li key={item.id}><header><strong>{t('Saved case {0}',index+1)}</strong><button className="text-button" disabled={busy} onClick={()=>void act('remove',item.id)}>{t('Remove saved case')}</button></header><pre>{session.functionName}({item.args.map(value=>JSON.stringify(value)).join(', ')})</pre><p>{t('Expected')}{labelSeparator}<code>{output(item.expected)}</code></p>{!item.compatible&&<p className="practice-regression-stale">{t('Test expectations changed. Run the full tests and save a current failure again.')}</p>}{outcome&&<p>{t(outcome.status==='passed'?'Passed':outcome.status==='error'?'Execution error':'Mismatch')} · {t('Actual')}{labelSeparator}<code>{outcome.status==='error'?outcome.error:output(outcome.actual)}</code></p>}</li>;})}</ol>
    </>}
    <small>{t('Saved inputs and expected values are kept together. Only compatible cases are checked. These checks do not change hidden-test results or count as solved questions.')}</small>
  </section>;
}
