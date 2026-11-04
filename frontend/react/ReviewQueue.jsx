import {MetaText} from './MetaText.jsx';
import {formatMeta} from '../display-format.mjs';
import {formatRatio} from '../display-format.mjs';
import {ActionArrow} from './ActionArrow.jsx';
import {formatDate} from '../date-format.mjs';
import React,{useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {reviewSchedule} from '../learning-records.mjs';

export function ReviewQueue({summary,date,name,onOpen}){
  const [filter,setFilter]=useState('due');
  const schedule=reviewSchedule(summary,date),items=schedule[filter];
  const displayDate=value=>formatDate(value);
  return <section className="learning-review-queue" aria-labelledby="review-queue-heading">
    <header className="learning-section-heading"><div><h2 id="review-queue-heading">{t('Return before you forget.')}</h2><p>{t('A short revisit today makes the next attempt easier.')}</p></div><div className="learning-filters" aria-label={t('Filter review schedule')}>{[['due','Due now'],['upcoming','Coming up']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{formatMeta([t(label),schedule[id].length])}</button>)}</div></header>
    <div className="review-schedule-intro"><span className="review-schedule-count"><strong>{schedule.due.length}</strong>{t(schedule.due.length===1?'Question due for review':'Questions due for review')}</span><p>{t('Missed cases come first. Passing on separate days spaces the next review further apart.')}</p></div>
    <div className="review-schedule-list">{items.map(item=><article className="review-schedule-row" key={item.id}><div className="review-schedule-title"><strong>{item.title||name(item.topic)}</strong><small><MetaText>{formatMeta([name(item.topic),t(({standard:'Core practice',extended:'Extension practice',challenge:'Challenge practice'})[item.level]||'Core practice')])}</MetaText></small></div><div className="review-schedule-status"><span className={item.failed?'needs-review':'learning-passed'}>{t(item.failed?'Retry missed cases':item.due?'Time to revisit':'Review scheduled')}</span><small>{item.failed?t('Last result: {0} / {1}',item.latest.passed,item.latest.total):t('Next review: {0}',displayDate(item.dueDate))}</small></div><button className="secondary-button" onClick={()=>onOpen({id:item.topic},item)}>{t('Revisit question')} <ActionArrow/></button></article>)}</div>
    {!items.length&&<p className="learning-empty" role="status">{t(filter==='due'?'You are caught up. Try a new question, or revisit one from Coming up.':'Your next reviews will appear after a recorded submission.')}</p>}
    <p className="review-schedule-note">{t('Review intervals: 1, 3, 7, 14 and 30 days. Same-day passing submissions do not advance the interval. A failed submission resets it. This is a practice reminder, not a mastery score.')}</p>
  </section>;
}
