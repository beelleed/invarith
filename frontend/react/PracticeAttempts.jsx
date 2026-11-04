import {formatRatio} from '../display-format.mjs';
import {labelSeparator} from '../i18n.mjs';
import {formatDateTime} from '../date-format.mjs';
import React,{useEffect,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {comparePracticeAttempts} from '../practice-attempts.mjs';
import {codeDiff} from '../evidence-tools.mjs';

export function PracticeAttempts({attempts=[],busy=false,onRestore}){
  const [beforeId,setBeforeId]=useState(''),[afterId,setAfterId]=useState('');
  useEffect(()=>{setBeforeId(attempts.at(-2)?.id||'');setAfterId(attempts.at(-1)?.id||'');},[attempts.at(-1)?.id]);
  const before=attempts.find(a=>a.id===beforeId),after=attempts.find(a=>a.id===afterId),comparison=comparePracticeAttempts(before,after),different=before&&after&&before.id!==after.id;
  const date=value=>formatDateTime(value);
  const label=(a,index)=>t('Submission {0} · {1} / {2} · {3}',index+1,a.passed,a.total,date(a.createdAt));
  const diff=different?codeDiff(before.code,after.code):[];
  return <section className="practice-attempt-history" aria-label={t('Solution history')}><header><h4>{t('Solution history')}</h4><span>{t('{0} saved submissions',attempts.length)}</span></header><p>{t('Keep the versions you actually tested. Restoring one only changes your editor draft.')}</p>
    {!attempts.length?<p>{t('Your next hidden-test submission starts this history. Older results without saved code cannot be reconstructed.')}</p>:<>
      <div className="practice-attempt-pickers"><label>{t('Baseline submission')}<select value={beforeId} disabled={attempts.length<2} onChange={e=>setBeforeId(e.target.value)}><option value="">{t('Choose a baseline')}</option>{attempts.map((a,index)=><option key={a.id} value={a.id}>{label(a,index)}</option>)}</select></label><label>{t('Selected submission')}<select value={afterId} onChange={e=>setAfterId(e.target.value)}>{attempts.map((a,index)=><option key={a.id} value={a.id}>{label(a,index)}</option>)}</select></label></div>
      {after&&<div className="practice-attempt-selected"><span>{t('Selected result')}{labelSeparator}<strong>{formatRatio(after.passed,after.total)}</strong></span><button className="secondary-button" disabled={busy} onClick={()=>onRestore(after.code)}>{t('Load this version into my draft')}</button><details><summary>{t('View submitted code')}</summary><pre>{after.code}</pre></details></div>}
      {different&&(comparison.comparable?<><div className="practice-attempt-totals" aria-live="polite"><span><strong>{comparison.fixed}</strong>{t('Cases fixed')}</span><span><strong>{comparison.regressed}</strong>{t('Cases regressed')}</span><span><strong>{after.total}</strong>{t('Identical cases compared')}</span></div><details className="practice-attempt-case-details"><summary>{t('Compare case outcomes')}</summary><table><thead><tr>{['Case','Baseline','Selected','Change'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{comparison.rows.map(row=><tr key={row.index}><td>{row.index+1}</td><td>{t(row.before==='passed'?'Passed':row.before==='error'?'Execution error':'Mismatch')}</td><td>{t(row.after==='passed'?'Passed':row.after==='error'?'Execution error':'Mismatch')}</td><td className={'attempt-change-'+row.change}>{t(row.change==='fixed'?'Fixed':row.change==='regressed'?'Regressed':'Unchanged')}</td></tr>)}</tbody></table></details></>:<p className="practice-attempt-incompatible" role="status">{t('These submissions used different contracts or tests. Code can be compared, but fixes and regressions cannot be counted.')}</p>)}
      {before&&after&&!different&&<p>{t('Select two different submissions to compare.')}</p>}
      {different&&<div className="practice-attempt-diff"><h5>{t('Code changes · Baseline → selected')}</h5>{diff.length?<pre>{diff.map((row,index)=><span className={'attempt-diff-'+row.kind} key={index}>{row.kind==='added'?'+ ':row.kind==='removed'?'− ':'  '}{row.text}{'\n'}</span>)}</pre>:<p>{t('The submitted code is identical.')}</p>}</div>}
    </>}
    <small>{t('Latest 10 actual hidden-test executions. Public runs and reused results do not add versions. Passing describes tested cases only.')}</small>
  </section>;
}
