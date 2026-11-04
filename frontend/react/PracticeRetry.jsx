import React from 'react';
import {t} from '../i18n.mjs';
export function PracticeRetry({session,busy,onRetry,onOpen}){
  return <section className="practice-retry" aria-label={t('Start the same question again')}>
    <div><h4>{t(session.retryOf?'A fresh attempt at a familiar problem.':'Try it again from the beginning.')}</h4><p>{t(session.retryOf?'This attempt starts from the original code. Earlier answers, hints and test results stay in the previous attempt.':'Keep this attempt and open a separate one with the same question, tests and original starter code.')}</p></div>
    <div className="practice-retry-actions"><button className="secondary-button" disabled={busy} onClick={onRetry}>{t('Start fresh attempt · No AI')}</button>{session.retryOf&&<button className="text-button" disabled={busy} onClick={()=>onOpen(session.retryOf.id)}>{t('Back to previous attempt')}</button>}</div>
    <small>{t('Debug and optimization practice keep the original flawed or slow starter. This is a previously seen question, not an independent assessment. Starting alone does not count toward your practice goal.')}</small>
  </section>;
}
