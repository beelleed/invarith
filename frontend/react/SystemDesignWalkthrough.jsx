import {formatRatio} from '../display-format.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {t,locale} from '../i18n.mjs';

export function SystemDesignWalkthrough({session,lesson,language,onGenerate,busy,Board}){
 const [index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[preparing,setPreparing]=useState(false),[voice,setVoice]=useState(language==='zh-TW'?'hsiaochen':'local'),[consent,setConsent]=useState(false),[error,setError]=useState('');
 const audio=useRef(null),epoch=useRef(0),abort=useRef(null),alive=useRef(true);
 const stop=()=>{epoch.current++;abort.current?.abort();audio.current?.pause();setPlaying(false);setPreparing(false);};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;abort.current?.abort();audio.current?.pause();};},[]);
 useEffect(()=>{
  if(!playing||!lesson)return;
  const player=audio.current,seq=++epoch.current,controller=new AbortController();abort.current=controller;let timer;
  const advance=()=>{if(!alive.current||seq!==epoch.current)return;if(index<lesson.chapters.length-1)setIndex(i=>i+1);else setPlaying(false);};
  if(voice==='captions')timer=setTimeout(advance,Math.max(6000,language==='zh-TW'?lesson.chapters[index].narration.length*190:lesson.chapters[index].narration.split(/\s+/).length*430));
  else void(async()=>{
   setPreparing(true);setError('');try{
    const online=voice==='hsiaochen';if(online&&!consent)throw Error('consent');
    const response=await fetch(online?'/api/system-design/narration':'/api/lessons/narration',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(150000)]),body:JSON.stringify(online?{id:session.id,language,chapterIndex:index,voice:'zh-TW-HsiaoChenNeural',allowOnline:true}:{language,text:lesson.chapters[index].narration})});
    const clip=await response.json();if(!response.ok||!/^\/api\/(?:taiwan-)?lesson-audio\/[a-f0-9]{64}\.wav$/.test(clip.url))throw Error('audio');if(seq!==epoch.current||!alive.current)return;
    player.src=clip.url;player.onended=advance;await player.play();if(seq===epoch.current)setPreparing(false);
   }catch(e){if(seq!==epoch.current||!alive.current)return;setError(t('Narration is unavailable. You can continue with captions or try another voice.'));setPreparing(false);setPlaying(false);}
  })();
  return()=>{epoch.current++;controller.abort();clearTimeout(timer);if(player){player.onended=null;player.pause();}};
 },[playing,index,voice,lesson,language,consent,session.id]);
 const choose=i=>{stop();setIndex(i);};
 if(session.status!=='finished')return <section className="design-walkthrough-locked"><h3>{t('Learn a worked approach')}</h3><p>{t('Finish your interview to unlock a step-by-step walkthrough. Try your own design before viewing an example.')}</p></section>;
 if(!lesson)return <section className="design-walkthrough"><header><div><p className="studio-eyebrow">{t('AFTER YOUR INTERVIEW')}</p><h3>{t('Learn a worked approach')}</h3><p>{t('Watch the reasoning grow from requirements to architecture, with a concrete example and an interview-style explanation.')}</p></div><button className="primary-button" disabled={busy} onClick={onGenerate}>{t(busy?'Working…':'Generate design walkthrough · AI credits')}</button></header><p>{t('One generation is saved for this interview and page language. Replaying it uses no model credits. This is one possible design, not an official answer.')}</p></section>;
 const chapter=lesson.chapters[index],capacity=lesson.capacity,{assumptions:a,estimates:e}=capacity;
 const number=x=>Number.isInteger(x)?x.toLocaleString(locale):x.toLocaleString(locale,{maximumSignificantDigits:6});
 return <section className="design-walkthrough"><header><div><p className="studio-eyebrow">{t('WORKED DESIGN · ONE POSSIBLE APPROACH')}</p><h3>{t('From the prompt to your interview answer')}</h3><p>{t('An AI-generated example to compare with your reasoning. Adapt the assumptions and tradeoffs to the actual question.')}</p></div><span>{formatRatio(index+1,lesson.chapters.length)}</span></header>
 <div className="design-lesson-player"><nav aria-label={t('Design walkthrough chapters')}>{lesson.chapters.map((c,i)=><button key={c.stage} type="button" aria-current={i===index?'step':undefined} onClick={()=>choose(i)}><span>{String(i+1).padStart(2,'0')}</span>{c.title}</button>)}</nav><article aria-live="polite"><h4>{chapter.title}</h4><p className="design-lesson-explanation">{chapter.explanation}</p>{chapter.stage==='estimate'&&<section className="design-lesson-formulas"><h5>{t('Workload assumptions')}</h5><p>{t('{0} new records/day · {1} reads per record · {2} bytes/record · {3} days · {4}× peak',number(a.dailyWrites),number(a.readRatio),number(a.recordBytes),number(a.retentionDays),number(a.peakFactor))}</p><dl>{[
 [t('Average writes / second'),`${number(a.dailyWrites)} ÷ 86,400 ≈ ${number(e.writeRps)}`],
 [t('Average reads / second'),`${number(a.dailyWrites)} × ${number(a.readRatio)} ÷ 86,400 ≈ ${number(e.readRps)}`],
 [t('Peak reads / second'),`${number(a.dailyWrites)} × ${number(a.readRatio)} × ${number(a.peakFactor)} ÷ 86,400 ≈ ${number(e.peakReadRps)}`],
 [t('Raw record storage'),`${number(a.dailyWrites)} × ${number(a.retentionDays)} × ${number(a.recordBytes)} = ${number(e.storageBytes)} bytes ≈ ${number(e.storageBytes/1e9)} GB`],
 ].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{t('One day = 86,400 seconds. GB uses 1,000,000,000 bytes. These estimates exclude indexes, replicas, backups and protocol overhead; explain additional costs separately.')}</p></section>}
 {chapter.board.nodes.length>0&&<div className="design-lesson-board"><Board value={chapter.board} preview={true} disabled={true} onChange={()=>{}}/></div>}
 <section className="design-lesson-say"><h5>{t('How I would explain it in an interview')}</h5><p>{chapter.sayIt}</p></section><section className="design-lesson-caption"><h5>{t('Teacher explanation')}</h5><p>{chapter.narration}</p></section></article></div>
 <footer className="design-lesson-controls"><button className="secondary-button" disabled={index===0} onClick={()=>choose(index-1)}>{t('Previous chapter')}</button><button className="primary-button" disabled={!playing&&voice==='hsiaochen'&&!consent} onClick={()=>{if(playing)stop();else{setError('');setPlaying(true);}}}>{t(playing?'Pause lesson':'Play lesson')}</button><button className="secondary-button" disabled={index===lesson.chapters.length-1} onClick={()=>choose(index+1)}>{t('Next chapter')}</button><label>{t('Narration')}<select aria-label={t('Design lesson narration')} value={voice} onChange={event=>{stop();setVoice(event.target.value);}}><option value="captions">{t('Captions only')}</option><option value="local">{t('Local narration')}</option>{language==='zh-TW'&&<option value="hsiaochen">HsiaoChen</option>}</select></label>{preparing&&<span role="status">{t('Preparing narration…')}</span>}</footer>
 {voice==='hsiaochen'&&<label className="design-online-consent"><input type="checkbox" checked={consent} onChange={e=>{stop();setConsent(e.target.checked);}}/>{t('Allow sending this lesson’s narration to the online voice service for HsiaoChen playback.')}</label>}{error&&<p role="alert">{error}</p>}<audio ref={audio} onError={()=>{if(alive.current){stop();setError(t('Narration is unavailable. You can continue with captions or try another voice.'));}}}/><small>{t('Saved AI teaching example · Not a benchmark or correctness proof.')} · {lesson.model} · {lesson.totalTokens??'—'} tokens</small>
 </section>;
}
