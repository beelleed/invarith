import {formatDateTime} from '../date-format.mjs';
import React from 'react';
import {locale,t} from '../i18n.mjs';
import {compareCustomCases} from '../custom-case-comparison.mjs';
import {codeDiff} from '../evidence-tools.mjs';
const status=row=>row?t(row.status==='passed'?'Matched your expectation':row.status==='error'?'Execution error':'Different from your expectation'):'—';
export function CustomCaseComparison({baseline,cases,run}){
  const comparison=compareCustomCases(baseline,cases,run);
  if(!comparison.comparable)return <p role="status">{t('These custom-test runs cannot be compared. Pin a current run as your new baseline.')}</p>;
  const diff=codeDiff(baseline.run.code,run.code);
  return <section className="custom-case-comparison" aria-label={t('Custom-test repair comparison')}><h5>{t('What changed in my tests?')}</h5><p>{t('Baseline from {0}',formatDateTime(baseline.run.createdAt))}</p><div className="practice-attempt-totals">{[[comparison.fixed,'Cases fixed'],[comparison.regressed,'Cases regressed'],[comparison.added,'New cases'],[comparison.removed,'Removed cases']].map(([n,label])=><span key={label}><strong>{n}</strong>{t(label)}</span>)}</div><p>{t('{0} identical custom cases compared',comparison.compared)}</p>
    <div className="custom-comparison-table"><table><thead><tr>{['Case','Baseline','Latest run','Change'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{comparison.rows.map((row,index)=><tr key={index}><td><strong>{row.item.label||t('Custom case {0}',row.index+1)}</strong><code>{JSON.stringify({args:row.item.args,kwargs:row.item.kwargs,expected:row.item.expected})}</code></td><td>{status(row.before)}</td><td>{status(row.after)}</td><td>{t(({fixed:'Fixed',regressed:'Regressed',added:'New case',removed:'Removed case',unchanged:'Unchanged'})[row.change])}</td></tr>)}</tbody></table></div>
    <details className="practice-attempt-diff"><summary>{t('Compare my tested code')}</summary>{diff.length?<pre>{diff.map((row,index)=><span className={'attempt-diff-'+row.kind} key={index}>{row.kind==='added'?'+ ':row.kind==='removed'?'− ':'  '}{row.text}{'\n'}</span>)}</pre>:<p>{t('The submitted code is identical.')}</p>}</details><small>{t('Only identical inputs and expected values count as fixes or regressions. These comparisons use your own expectations, not hidden-test grades.')}</small>
  </section>;
}
