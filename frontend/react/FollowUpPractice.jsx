import React,{useRef,useState} from 'react';
import {t} from '../i18n.mjs';
import {followUpFocus} from '../practice-focus.mjs';
export function FollowUpPractice({busy,onGenerate}){
  const [focus,setFocus]=useState('boundaries'),[difficulty,setDifficulty]=useState('same');
  const locked=useRef(false),generate=async()=>{if(busy||locked.current)return;locked.current=true;try{await onGenerate({focus,difficulty});}finally{locked.current=false;}};
  return <section className="practice-follow-up" aria-label={t('Related challenge')}><h4>{t('Take the idea into a different problem.')}</h4><p>{t('Choose what you want to practice next. Your current draft stays with this question.')}</p><div><label>{t('Learning focus')}<select value={focus} disabled={busy} onChange={e=>setFocus(e.target.value)}>{followUpFocus.map(item=><option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label><label>{t('Challenge difficulty')}<select value={difficulty} disabled={busy} onChange={e=>setDifficulty(e.target.value)}>{[['same','Same difficulty estimate'],['easy','Easy'],['medium','Medium'],['hard','Hard']].map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label></div><button className="secondary-button" disabled={busy} onClick={()=>void generate()}>{t('Generate related challenge · AI credits')}</button><small>{t('Uses this question and your selected focus. One AI request per click; no automatic retries. Candidate solutions are checked before the new question is saved.')}</small></section>;
}
