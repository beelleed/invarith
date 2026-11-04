import React from 'react';
import {t} from '../i18n.mjs';
import {practiceLearningStep} from '../practice-learning-path.mjs';
import {FollowUpPractice} from './FollowUpPractice.jsx';
export function PracticeLearningPath({session,result,busy,onPanel,onAction}){
  const step=practiceLearningStep(result);if(!step)return null;
  return <section className="practice-learning-path" aria-label={t('Your next learning step')}><small>{t('Your next learning step')}</small><h4>{t(step.title)}</h4><p>{t(step.description)}</p><div className="practice-learning-actions">
    {step.phase==='investigate'&&<><button type="button" className="primary-button" disabled={busy} onClick={()=>onPanel('debug')}>{t('Record a hypothesis · No AI')}</button><button type="button" className="text-button" disabled={busy} onClick={()=>onPanel('tests')}>{t('Design a regression test · No AI')}</button></>}
    {step.phase==='submit'&&<button type="button" className="primary-button" disabled={busy} onClick={()=>void onAction('submit')}>{t('Check hidden cases next')}</button>}
    {step.phase==='transfer'&&<><button type="button" className="primary-button" disabled={busy} onClick={()=>onPanel('explain')}>{t('Practice explaining · No AI to start')}</button><button type="button" className="text-button" disabled={busy} onClick={()=>onPanel('plan')}>{t('Review my solution plan')}</button></>}
  </div>{step.phase==='transfer'&&<FollowUpPractice key={session.id} practiceId={session.id} busy={busy} onGenerate={settings=>onAction('follow-up',settings)}/>}</section>;
}
