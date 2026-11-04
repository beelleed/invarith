import {formatRatio} from '../display-format.mjs';
import {formatDate} from '../date-format.mjs';
import React,{useState} from 'react';
import {t} from '../i18n.mjs';
import {dailyPracticePlan} from '../daily-plan.mjs';

export function DailyPlan({summary,goal,date,name,onPractice}){
  const plan=dailyPracticePlan(summary,goal,date),[error,setError]=useState('');
  const reason=id=>t(({missed_cases:'Revisit missed cases',due_review:'Due for spaced review',unfinished:'Continue unfinished work',new_topic:'Explore an unpracticed topic',next_level:'Build on a passing core exercise',early_review:'Optional early review'})[id]);
  const open=item=>{setError('');const event=new CustomEvent('daily-practice-selected',{cancelable:true,detail:{action:item.action,sessionId:item.sessionId,taskId:item.id,topic:item.topic}});if(document.dispatchEvent(event))setError(t('Finish the current operation, then open this planned question.'));else onPractice();};
  const title=item=>item.title||name(item.topic)+' · '+t(({standard:'Core practice',extended:'Extension practice',challenge:'Challenge practice'})[item.level]||'Core practice');
  return <section className="daily-plan" aria-labelledby="daily-plan-heading"><header><div><h2 id="daily-plan-heading">{t('A small plan for today.')}</h2><p>{t('Start with a review, continue unfinished work, then explore another topic. Your daily goal sets the pace.')}</p></div><span>{formatDate(plan.date)}</span></header>
    <div className="daily-plan-progress"><strong>{formatRatio(Math.min(plan.practiced,goal),goal)}</strong><span>{t('Distinct questions practiced today')}</span><p>{t('Recorded submissions count as practice, even when cases fail. Passing is shown separately.')}</p></div>
    {error&&<p role="alert">{error}</p>}
    {plan.completed.length>0&&<section className="daily-plan-finished"><h3>{t('Already practiced today')}</h3>{plan.completed.map(item=><article key={item.id}><span className="daily-plan-check" aria-hidden="true">✓</span><div><strong>{title(item)}</strong><small>{t(item.isReview?'Revisited':'New practice')} · {t('Latest result: {0} / {1}',item.latest.passed,item.latest.total)}</small></div><button className="text-button" onClick={()=>open({...item,action:'resume',sessionId:item.latest.sessionId})}>{t('Open saved attempt')}</button></article>)}</section>}
    {plan.remaining===0?<p className="daily-plan-complete" role="status">{t('Daily goal reached. Take a break, or choose more practice when you feel ready.')}</p>:<section className="daily-plan-next"><h3>{t('Your next steps')}</h3>{plan.items.map((item,index)=><article key={item.id}><span className="daily-plan-number">{String(index+1).padStart(2,'0')}</span><div><strong>{title(item)}</strong><small>{reason(item.reason)}</small>{item.action==='review'&&<small>{t('Starts from the original starter; your previous attempt stays saved.')}</small>}</div><button className="secondary-button" onClick={()=>open(item)}>{t(item.action==='review'?'Review from starter':item.action==='resume'?'Continue question':'Open prepared question')}</button></article>)}{!plan.items.length&&<p>{t('No more suggestions are available right now. You can choose a topic from the practice desk.')}</p>}</section>}
    <small className="daily-plan-note">{t('Suggestions update as you submit work or change your daily goal. New questions use prepared Invarith exercises. This is a practice plan, not a skill rating.')}</small>
  </section>;
}
