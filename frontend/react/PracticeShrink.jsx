import {labelSeparator} from '../i18n.mjs';
import {formatDateTime} from '../date-format.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {canonical} from '../evidence-tools.mjs';
const output=value=>JSON.stringify(value)??t('No return value');
export function PracticeShrink({session,code,result,busy,onBusy,onSession}){
  const [data,setData]=useState(null),[phase,setPhase]=useState(''),[error,setError]=useState(''),alive=useRef(true),locked=useRef(false),controller=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  const small=data?.status==='reduced'?data.reduced:null,group=session.regressions||{revision:0,cases:[]},saved=small&&group.cases.some(item=>item.compatible&&canonical(item.args)===canonical(small.args)&&canonical(item.expected)===canonical(small.expected));
  const act=async save=>{if(busy||locked.current)return;locked.current=true;setPhase(save?'save':'search');setError('');onBusy(true);controller.current=new AbortController();
    try{const base={id:session.id,code,action:result.scope==='hidden_cases'?'submit':'examples',createdAt:result.createdAt},response=await fetch(save?'/api/practice/regressions':'/api/practice/shrink',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(180000)]),body:JSON.stringify(save?{...base,operation:'capture',revision:group.revision,shrinkId:data.id}:{...base,refresh:Boolean(data)})});const value=await response.json();if(!response.ok)throw Error(value.error||'Could not reduce this failing input.');if(alive.current){if(save)onSession(value);else setData(value);}}
    catch(e){if(alive.current)setError(t(e.message));}finally{locked.current=false;if(alive.current)setPhase('');onBusy(false);}
  };
  const reload=async()=>{if(busy||locked.current)return;locked.current=true;try{const response=await fetch('/api/practice/'+session.id,{signal:AbortSignal.timeout(15000)}),value=await response.json();if(!response.ok)throw Error(value.error||'Could not update saved cases.');if(alive.current){onSession(value);setError('');}}catch(e){if(alive.current)setError(t(e.message));}finally{locked.current=false;}};
  if(!session.shrinkSupported)return null;
  return <section className="practice-shrink" aria-label={t('Smaller counterexample')}><header><div><h4>{t('Make the failure easier to see.')}</h4><p>{t('Try shorter inputs, with a fresh expected result computed for each one.')}</p></div><button className="secondary-button" disabled={busy||!Number.isFinite(Date.parse(result.createdAt))} onClick={()=>void act(false)}>{t(phase==='search'?'Searching shorter inputs…':data?'Search again · No AI':'Find a smaller failure · No AI')}</button></header>
    {phase==='search'&&<p role="status">{t('This search may run several Python jobs. Your original tests stay unchanged.')}</p>}{error&&<p role="alert">{error} <button className="text-button" disabled={busy} onClick={()=>void reload()}>{t('Reload saved cases')}</button></p>}
    {data&&<><p className="practice-shrink-status" role="status">{t(({reduced:'A shorter failing input was confirmed by a final replay.',not_reduced:'No shorter failure was found within this search.',unstable:'The result did not reproduce consistently. No smaller failure was established.',incomplete:'The search limit was reached before final confirmation.'})[data.status])}</p><small>{t('Checked {0} inputs',data.attempts.length)} · {t(data.cached?'Saved search result':'New Python search')} · {formatDateTime(data.createdAt)}</small>
      {small&&<><p className="practice-shrink-size">{t('{0} → {1} items or characters',data.original.args[0].length,small.args[0].length)}</p><div className="practice-shrink-comparison">{[[data.original,'Original failing input'],[small,'Smaller failing input']].map(([item,label])=><div key={label}><h5>{t(label)}</h5><pre>{session.functionName}({item.args.map(value=>JSON.stringify(value)).join(', ')})</pre><p>{t('Expected')}{labelSeparator}<code>{output(item.expected)}</code></p><p>{t('Actual')}{labelSeparator}<code>{item.status==='error'?item.error:output(item.actual)}</code></p></div>)}</div><button className="secondary-button" disabled={busy||Boolean(saved)||group.cases.length>=10} onClick={()=>void act(true)}>{t(phase==='save'?'Saving case…':saved?'Smaller case already saved':'Save smaller case for regression checks')}</button></>}
    </>}
    <small className="practice-shrink-note">{t('Up to 10 case executions. Deletion-only search; an even smaller failure may still exist. Supported curated list and string questions only.')}</small>
  </section>;
}
