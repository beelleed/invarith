import {formatRatio} from '../display-format.mjs';
import {ActionArrow} from './ActionArrow.jsx';
import {formatDate} from '../date-format.mjs';
import {labelSeparator} from '../i18n.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {t} from '../i18n.mjs';
import {weeklyPracticeReview} from '../weekly-review.mjs';

export function WeeklyReview({activity,date,name,onPractice}){
  const report=weeklyPracticeReview(activity,date),[period,setPeriod]=useState('current'),[all,setAll]=useState(false),[notice,setNotice]=useState(''),[text,setText]=useState(''),[error,setError]=useState(''),selected=report[period];
  const copySequence=useRef(0);useEffect(()=>()=>{copySequence.current++;},[]);
  const change=value=>{copySequence.current++;setPeriod(value);setAll(false);setNotice('');setText('');setError('');};
  const summary=()=>[t('Seven-day practice review')+' · '+formatDate(selected.start)+' – '+formatDate(selected.end),t('Questions practiced')+labelSeparator+selected.questions,t('Active days')+labelSeparator+selected.activeDays+'/7',t('Saved submissions')+labelSeparator+selected.submissions,t('Questions with a passing latest result')+labelSeparator+selected.passing,...selected.topics.map(row=>'- '+name(row.topic)+labelSeparator+t('Questions: {0}; latest passing: {1}; submissions: {2}',row.questions,row.passing,row.submissions)),t('Saved test outcomes describe tested inputs, not mastery.')].join('\n');
  const copy=async()=>{const value=summary(),job=++copySequence.current;try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(value);if(job===copySequence.current){setNotice(t('Seven-day summary copied.'));setText('');}}catch{if(job===copySequence.current){setText(value);setNotice(t('Your browser could not copy automatically. Select the summary below to copy it.'));}}};
  const open=row=>{setError('');const event=new CustomEvent('practice-saved-requested',{cancelable:true,detail:{practiceId:row.sessionId,topic:row.topic}});if(document.dispatchEvent(event))setError(t('Finish the current operation, then open this saved attempt.'));else onPractice();};
  const delta=value=>t('{0} vs previous 7 days',value>0?'+'+value:String(value));
  return <section className="weekly-review" aria-labelledby="weekly-review-heading"><header><div><h3 id="weekly-review-heading">{t('Your week in practice.')}</h3><p>{t('See what you practiced and which saved results deserve another look.')}</p></div><button className="text-button" onClick={()=>void copy()}>{t('Copy seven-day summary')}</button></header>
    <div className="weekly-review-toolbar"><nav aria-label={t('Practice review period')}>{[['current','Last 7 days'],['previous','Previous 7 days']].map(([key,label])=><button key={key} aria-pressed={period===key} onClick={()=>change(key)}>{t(label)}</button>)}</nav><span>{formatDate(selected.start)} – {formatDate(selected.end)}</span></div>
    <div className="weekly-review-totals">{[['questions','Questions practiced'],['activeDays','Active days'],['submissions','Saved submissions']].map(([key,label])=><div key={key}><strong>{selected[key]}</strong><span>{t(label)}</span>{period==='current'&&<small>{delta(report.delta[key])}</small>}</div>)}</div>
    <p>{t('Latest results are taken separately for each question within the selected date range.')}</p><p>{t('Questions with a non-passing latest result: {0}',selected.needsReview)}</p>
    {error&&<p role="alert">{error}</p>}
    <div className="weekly-review-table"><table><thead><tr>{['Topic','Questions practiced','Latest passing','Saved submissions',''].map((label,index)=><th key={index} scope="col">{t(label)}</th>)}</tr></thead><tbody>{(all?selected.topics:selected.topics.slice(0,8)).map(row=><tr key={row.topic}><th scope="row">{name(row.topic)}</th><td>{row.questions}</td><td>{formatRatio(row.passing,row.questions)}</td><td>{row.submissions}</td><td><button className="text-button" onClick={()=>open(row)}>{t('Open a saved question')} <ActionArrow/></button></td></tr>)}</tbody></table></div>
    {!selected.topics.length&&<p>{t('No recorded submissions in this period. Your next practice can be a small one.')}</p>}{!all&&selected.topics.length>8&&<button className="text-button" onClick={()=>setAll(true)}>{t('Show all {0} topics',selected.topics.length)}</button>}
    {notice&&<p role="status">{notice}</p>}{text&&<label className="weekly-review-copy">{t('Summary to copy')}<textarea readOnly value={text} onFocus={event=>event.target.select()}/></label>}
    <small className="weekly-review-note">{t('This review uses retained saved submissions. Retries of the same question count once in question totals, but each recorded submission counts as practice activity. The last-7-days view includes today so far; activity changes are not skill scores.')}</small>
  </section>;
}
