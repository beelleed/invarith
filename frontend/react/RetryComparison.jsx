import {formatRatio} from '../display-format.mjs';
import {formatDateTime} from '../date-format.mjs';
import React,{useEffect,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {codeDiff} from '../evidence-tools.mjs';

export function RetryComparison({session,code,assistantCount=0}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0),last=session.attempts?.at(-1)?.id;
  useEffect(()=>{if(!last)return;let alive=true;const controller=new AbortController();setLoading(true);setError('');void(async()=>{try{const response=await fetch('/api/practice-retry-comparison/'+session.id,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});const value=await response.json();if(!response.ok)throw Error(value.error||'Could not compare retry attempts.');if(alive){setData(value);setLoading(false);}}catch(e){if(alive&&!controller.signal.aborted){setError(t(e.name==='Error'?e.message:'Could not compare retry attempts.'));setLoading(false);}}})();return()=>{alive=false;controller.abort();};},[session.id,last,assistantCount,retry]);
  const date=value=>Number.isFinite(Date.parse(value))?formatDateTime(value):t('Date unavailable');
  return <section className="retry-comparison" aria-labelledby={'retry-compare-'+session.id}><header><div><h3 id={'retry-compare-'+session.id}>{t('What changed on your retry?')}</h3><p>{t('Compare your latest saved hidden-test submission with the version captured when this retry began.')}</p></div><span>{t('Saved evidence · No AI')}</span></header>
    {!last&&<p>{t('Submit this retry to hidden tests first. The previous code stays out of this comparison until then.')}</p>}
    {loading&&<p role="status">{t('Comparing saved attempts…')}</p>}{error&&<p role="alert">{error} <button className="text-button" onClick={()=>setRetry(value=>value+1)}>{t('Reload comparison')}</button></p>}
    {!loading&&!error&&last&&data&&!data.available&&<p>{t(data.reason==='baseline_missing'?'No submitted version was captured when this retry began. After submitting this attempt, start a new retry to record a comparison baseline.':'The saved evidence is incomplete. Submit this retry again before comparing.')}</p>}
    {!loading&&!error&&data?.available&&<RetryComparisonEvidence data={data} code={code} date={date}/>}
    <small>{t('This is a previously seen question. Assistant counts reflect recorded in-app requests only; other help and lesson viewing are not measured. Better test results or fewer requests do not prove independent skill improvement.')}</small>
  </section>;
}
export function RetryComparisonEvidence({data,code,date}){
  const diff=codeDiff(data.before.code,data.after.code),status=value=>t(value==='passed'?'Passed':value==='error'?'Execution error':'Mismatch');
  return <><div className="retry-comparison-versions">{[['before','Previous attempt at retry start'],['after','This retry’s saved submission']].map(([key,label])=><div key={key}><h4>{t(label)}</h4><strong>{formatRatio(data[key].passed??'—',data[key].total??'—')}</strong><small>{date(data[key].createdAt)}</small><p>{t('Recorded assistant requests: {0}',data[key].assistantRequests??'—')}</p></div>)}</div>
    {code!==data.after.code&&<p className="retry-comparison-note">{t('Your editor differs from this saved submission. The comparison does not grade your current draft.')}</p>}
    {data.comparable?<><div className="retry-comparison-totals" aria-live="polite">{[[data.fixed,'Cases fixed'],[data.regressed,'Cases regressed'],[data.rows.length,'Identical cases compared']].map(([count,label])=><span key={label}><strong>{count}</strong>{t(label)}</span>)}</div><details className="practice-attempt-case-details"><summary>{t('Compare case outcomes')}</summary><div className="ai-practice-table"><table><thead><tr>{['Case','Baseline','Selected','Change'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{data.rows.map(row=><tr key={row.index}><td>{row.index+1}</td><td>{status(row.before)}</td><td>{status(row.after)}</td><td>{t(({fixed:'Fixed',regressed:'Regressed',unchanged:'Unchanged'})[row.change])}</td></tr>)}</tbody></table></div></details></>:<p className="retry-comparison-note">{t('Contracts, test expectations or saved evidence differ. Code can be compared, but fixes and regressions cannot be counted.')}</p>}
    <div className="practice-attempt-diff"><h4>{t('Code changes · Previous attempt → retry')}</h4>{diff.length?<pre>{diff.map((row,index)=><span key={index} className={'attempt-diff-'+row.kind}>{row.kind==='added'?'+ ':row.kind==='removed'?'− ':'  '}{row.text}{'\n'}</span>)}</pre>:<p>{t('The submitted code is identical.')}</p>}</div><small>{t('Previous version captured at {0}. Later edits to that attempt do not change this baseline.',date(data.capturedAt))}</small>
  </>;
}
