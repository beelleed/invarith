import React,{useId,useState} from 'react';
import {t} from '../i18n.mjs';
import {traceQuestions,compareTracePrediction} from '../trace-challenge.mjs';

export function TraceChallenge({replay}){
  const headingId=useId(),predictionId=useId();
  const questions=traceQuestions(replay),[position,setPosition]=useState(0),[answer,setAnswer]=useState(''),[results,setResults]=useState({});
  const question=questions[position],checked=question?results[question.id]:null,rows=Object.values(results),compared=rows.filter(row=>row.answer!==null),matched=compared.filter(row=>row.matches).length;
  const reveal=skip=>{if(!question||checked)return;setResults(current=>({...current,[question.id]:{answer:skip?null:answer.trim(),matches:skip?null:compareTracePrediction(answer,question.expected)}}));};
  const move=offset=>{setPosition(current=>Math.max(0,Math.min(questions.length-1,current+offset)));setAnswer('');};
  return <section className="trace-challenge" aria-labelledby={headingId}><header><div><h4 id={headingId}>{t('Predict the next state.')}</h4><p>{t('Read the highlighted line. Predict one variable before revealing the next recorded state.')}</p></div><span>{t('No AI · Uses this replay')}</span></header>
    {!question?<p>{t('No suitable state changes were captured. This quiz uses complete integer, boolean and None values in adjacent line events. Explore the trace instead.')}</p>:<>
      <div className="trace-challenge-progress"><span>{t('Question {0} of {1}',position+1,questions.length)}</span><span>{t('{0} compared · {1} matched · {2} revealed',compared.length,matched,rows.length-compared.length)}</span></div>
      <p>{t('Input')}</p><pre className="trace-challenge-input">{replay.functionName}({[...(replay.args||[]).map(value=>JSON.stringify(value)),...Object.entries(replay.kwargs||{}).map(([key,value])=>key+'='+JSON.stringify(value))].join(', ')})</pre>
      <div className="trace-challenge-prompt"><p>{t('Before line {0}',question.line)} · <code>{question.function}</code></p><dl>{Object.entries(question.variables).slice(0,8).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}</dl><pre><span>{question.line}</span><code>{question.source}</code></pre><p>{t('After this line executes, what value will {0} have at the next recorded line?',question.variable)}</p></div>
      <form onSubmit={event=>{event.preventDefault();if(answer.trim())reveal(false);}}><label htmlFor={predictionId}>{t('Your predicted value')}<input id={predictionId} autoComplete="off" spellCheck="false" maxLength={160} value={checked?checked.answer??'':answer} disabled={Boolean(checked)} placeholder={t('An integer, True, False or None')} onChange={event=>setAnswer(event.target.value)}/></label><button className="secondary-button" type="submit" disabled={!answer.trim()||Boolean(checked)}>{t('Compare with execution')}</button><button className="text-button" type="button" disabled={Boolean(checked)} onClick={()=>reveal(true)}>{t('Reveal without guessing')}</button></form>
      {checked&&<div className={`trace-challenge-reveal ${checked.matches?'is-matched':''}`} role="status"><strong>{t(checked.answer===null?'Observed value revealed':checked.matches?'Your prediction matches this observation.':'The observed value differs. Follow the highlighted line again.')}</strong><p><code>{question.variable}</code>: <code>{question.before}</code> → <code>{question.expected}</code></p><small>{t('Captured before line {0}. This is an observed state, not an AI explanation.',question.nextLine)}</small></div>}
      <div className="trace-challenge-navigation"><button type="button" className="text-button" disabled={position===0} onClick={()=>move(-1)}>{t('Previous question')}</button><button type="button" className="secondary-button" disabled={position===questions.length-1||!checked} onClick={()=>move(1)}>{t('Next question')}</button></div>
      {rows.length===questions.length&&<p className="trace-challenge-complete" role="status">{t('Practice complete. Explain why each value changed before trying another input.')}</p>}
    </>}
    <small className="trace-challenge-note">{t('This practice uses a replay you may already have explored. It is not an independent skill assessment and does not change test results. Only captured steps are used; a truncated trace may omit later behavior.')}</small>
  </section>;
}
