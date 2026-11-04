import React,{useEffect,useRef,useState} from 'react';
import {t,locale} from '../i18n.mjs';
import {followUpFocus} from '../practice-focus.mjs';
export function FollowUpPractice({busy,onGenerate,practiceId}){
  const key=practiceId?'invarith-next-focus:'+locale+':'+practiceId:null;
  const [saved]=useState(()=>{try{return key?JSON.parse(localStorage.getItem(key))||{}:{};}catch{return {};}});
  const [focus,setFocus]=useState(followUpFocus.some(item=>item.id===saved.focus)?saved.focus:'boundaries'),[difficulty,setDifficulty]=useState(['same','easy','medium','hard'].includes(saved.difficulty)?saved.difficulty:'same');
  useEffect(()=>{if(key)try{localStorage.setItem(key,JSON.stringify({focus,difficulty}));}catch{}},[key,focus,difficulty]);
  const locked=useRef(false),generate=async()=>{if(busy||locked.current)return;locked.current=true;try{await onGenerate({focus,difficulty});}finally{locked.current=false;}};
  return <section className="practice-follow-up" aria-label={t('Related challenge')}><h4>{t('Take the idea into a different problem.')}</h4><p>{t('Choose what you want to practice next. Your current draft stays with this question.')}</p><div><label>{t('Learning focus')}<select value={focus} onChange={e=>setFocus(e.target.value)}>{followUpFocus.map(item=><option key={item.id} value={item.id}>{t(item.label)}</option>)}</select></label><label>{t('Challenge difficulty')}<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{[['same','Same difficulty estimate'],['easy','Easy'],['medium','Medium'],['hard','Hard']].map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label></div><p role="status">{t(busy?'You can choose the next challenge now. Wait for the current action before generating.':'Choose a focus and difficulty, then generate your next challenge.')}</p><button className="secondary-button" disabled={busy} onClick={()=>void generate()}>{t('Generate related challenge · AI credits')}</button><small>{t('Uses this question, saved test counts and your chosen focus. Hidden cases are not sent. One AI request per click; no automatic retries.')}</small></section>;
}
