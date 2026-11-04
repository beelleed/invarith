import {formatRatio} from '../display-format.mjs';
import {SpeechTermSuggestions} from './SpeechTermSuggestions.jsx';
import {microphoneFailure,microphoneGuide} from '../microphone-support.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {locale,t,language} from '../i18n.mjs';
import {readOralDraft,writeOralDraft,clearOralDraft} from '../oral-draft.mjs';

async function request(action,body){const response=await fetch('/api/oral-practice/'+action,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Oral practice request failed.');return data;}

function Microphone({value,onChange,disabled,onRecording,active=true}){
  const [consent,setConsent]=useState(false),[recording,setRecording]=useState(false),[supported,setSupported]=useState(false),[status,setStatus]=useState(''),[preview,setPreview]=useState(''),[audio,setAudio]=useState('');
  const latest=useRef(value),runtime=useRef({generation:0,mounted:true}),audioRef=useRef(null);latest.current=value;
  const stop=(abort=false)=>{
    const state=runtime.current;state.generation++;clearTimeout(state.timer);if(abort)audioRef.current?.pause();
    if(state.recognition){try{abort?state.recognition.abort():state.recognition.stop();}catch{}if(abort){state.recognition.onresult=null;state.recognition.onend=null;state.recognition.onerror=null;state.recognition=null;}}
    if(state.recorder?.state==='recording')state.recorder.stop();state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;
    if(state.mounted){setRecording(false);onRecording(Boolean(state.recognition&&!abort));setPreview('');}
  };
  useEffect(()=>{
    const state=runtime.current;state.mounted=true;setSupported(Boolean(navigator.mediaDevices?.getUserMedia&&window.MediaRecorder));
    const hide=()=>{if(document.hidden)stop(true);},leave=()=>stop(true);
    document.addEventListener('visibilitychange',hide);document.addEventListener('workspace-view-changed',leave);window.addEventListener('pagehide',leave);window.addEventListener('invarith-stop-microphone',leave);
    const host=document.getElementById('learning-practice'),observer=new MutationObserver(()=>{if(host?.hidden)stop(true);});if(host)observer.observe(host,{attributes:true,attributeFilter:['hidden']});
    return()=>{state.mounted=false;stop(true);if(state.url)URL.revokeObjectURL(state.url);observer.disconnect();document.removeEventListener('visibilitychange',hide);document.removeEventListener('workspace-view-changed',leave);window.removeEventListener('pagehide',leave);window.removeEventListener('invarith-stop-microphone',leave);};
  },[]);
  useEffect(()=>{if(!active)stop(true);},[active]);
  const start=async()=>{
    if(!active||!consent||disabled||recording||runtime.current.recognition)return;window.dispatchEvent(new Event('invarith-stop-microphone'));const state=runtime.current,generation=++state.generation;setRecording(true);onRecording(true);setStatus(t('Allow microphone access to begin.'));
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!state.mounted||generation!==state.generation){stream.getTracks().forEach(track=>track.stop());return;}
      state.stream=stream;const recorder=new MediaRecorder(stream),chunks=[];state.recorder=recorder;
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      recorder.onstop=()=>{if(!state.mounted)return;if(state.recorder===recorder&&state.stream)stop();if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));setAudio(state.url);};
      recorder.onerror=()=>{if(state.mounted){stop(true);setStatus(t('Recording failed. You can type your explanation.'));}};recorder.start(1000);
      const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(Recognition){
        const recognition=new Recognition(),processed=new Set();state.recognition=recognition;recognition.lang=language.speech;recognition.continuous=true;recognition.interimResults=true;
        recognition.onresult=event=>{if(!state.mounted||state.recognition!==recognition)return;const final=[],interim=[];for(let i=event.resultIndex;i<event.results.length;i++){const item=event.results[i];if(item.isFinal&&!processed.has(i)){processed.add(i);final.push(item[0].transcript);}else if(!item.isFinal)interim.push(item[0].transcript);}if(final.length){const next=[latest.current,...final].filter(Boolean).join(' ').slice(0,4000);latest.current=next;onChange(next);}setPreview(interim.join(' '));};
        recognition.onerror=()=>{if(state.mounted)setStatus(t('Transcription is unavailable. Your recording continues; type the explanation after listening.'));};
        recognition.onend=()=>{if(state.mounted&&state.recognition===recognition){state.recognition=null;if(!state.stream)onRecording(false);setPreview('');setStatus(t(state.stream?'Transcription stopped. Stop the recording when you finish.':'Recording stopped. Review your transcript.'));}};
        try{recognition.start();}catch{state.recognition=null;}
      }
      setStatus(t(Recognition?'Recording. Review the transcript before sending.':'Recording without transcription. Listen back, then type your explanation.'));
      state.timer=setTimeout(()=>{stop();if(state.mounted)setStatus(t('One-minute recording complete. Review your transcript.'));},60000);
    }catch(error){stop(true);setStatus(t(microphoneFailure(error)));}
  };
  return <div className="oral-microphone"><label className="oral-consent"><input type="checkbox" checked={consent} disabled={disabled} onChange={event=>{setConsent(event.target.checked);if(!event.target.checked)stop(true);}}/>{t('Allow recording. Browser transcription may send audio to its speech service.')}</label><div className="oral-actions"><button className="secondary-button" disabled={disabled||!active||!supported||!consent||recording} onClick={()=>void start()}>{t('Record explanation')}</button><button className="text-button" disabled={!recording} onClick={()=>{stop();setStatus(t('Recording stopped. Review your transcript.'));}}>{t('Stop recording')}</button></div>{!supported&&<p>{t('Recording is unavailable in this browser. Type your explanation below.')}</p>}{status&&<p role="status">{status}</p>}{preview&&<p aria-live="polite">{preview}</p>}{audio&&<audio ref={audioRef} controls src={audio} aria-label={t('Listen to your explanation')}/>}<details className="microphone-help"><summary>{t('Microphone not working?')}</summary><p>{t(microphoneGuide)}</p><p>{t('Typing follows the same feedback process. A written transcript review does not evaluate voice quality or pronunciation.')}</p></details><small>{t('Recordings stay in this page and are cleared when you leave. Only the reviewed text is sent for AI feedback.')}</small></div>;
}

function OralQuestionVoice({text,active}){
 const utterance=useRef(null),[status,setStatus]=useState('');const supported=Boolean(globalThis.speechSynthesis&&globalThis.SpeechSynthesisUtterance);
 const stop=()=>{if(utterance.current){utterance.current.onend=null;utterance.current.onerror=null;speechSynthesis.cancel();utterance.current=null;}};
 useEffect(()=>{stop();setStatus('');return stop;},[text,active]);
 const play=()=>{stop();const voice=new SpeechSynthesisUtterance(text);voice.lang=language.speech;const voices=speechSynthesis.getVoices();voice.voice=voices.find(v=>v.lang===language.speech&&/HsiaoChen|Jenny|Natural/i.test(v.name))||voices.find(v=>v.lang===language.speech)||null;voice.onend=()=>{utterance.current=null;setStatus('');};voice.onerror=()=>{utterance.current=null;setStatus(t('Voice playback failed. The question remains available as text.'));};utterance.current=voice;speechSynthesis.speak(voice);};
 return <div className="oral-question-voice"><button type="button" className="text-button" disabled={!supported||!active||!text} onClick={play}>{t('Hear the question')}</button><button type="button" className="text-button" onClick={stop}>{t('Stop voice')}</button>{status&&<p role="status">{status}</p>}</div>;
}
export function OralPractice({session,code,result,busy,onBusy,active=true}){
  const [oral,setOral]=useState(null),[mode,setMode]=useState('coaching'),[answer,setAnswer]=useState(''),[error,setError]=useState(''),[recording,setRecording]=useState(false),[answerSaved,setAnswerSaved]=useState(true);
  const generation=useRef(0),actionLock=useRef(false),draftKey=`invarith-oral:${session.id}:${locale}`;
  useEffect(()=>{const job=generation.current;let id;try{id=localStorage.getItem(draftKey);}catch{}if(id)void request(id).then(value=>{if(generation.current===job&&value.practiceId===session.id&&value.language===language.speech){setOral(value);setMode(value.mode);try{setAnswer(readOralDraft(localStorage,value,locale));}catch{setAnswer('');}}}).catch(()=>{});return()=>{generation.current++;};},[session.id]);
  const editAnswer=value=>{setAnswer(value);try{setAnswerSaved(writeOralDraft(localStorage,oral,locale,value));}catch{setAnswerSaved(false);}};
  const eligible=Boolean(result&&code===session.code),stale=Boolean(oral&&oral.code!==code),locked=busy||recording;
  const act=async action=>{
    if(locked||actionLock.current)return;actionLock.current=true;onBusy(true);setError('');const job=++generation.current;
    try{const value=await request(action,action==='start'?{practiceId:session.id,code,mode,language:language.speech}:action==='answer'?{id:oral.id,round:oral.round,answer}:{id:oral.id});if(job!==generation.current)return;setOral(value);setAnswerSaved(true);try{if(action==='answer')clearOralDraft(localStorage,oral,locale);setAnswer(readOralDraft(localStorage,value,locale));localStorage.setItem(draftKey,value.id);}catch{setAnswer('');}}
    catch(e){if(job===generation.current)setError(t(e.message));}finally{actionLock.current=false;onBusy(false);}
  };
  const label=id=>t(({approach:'Approach and reasoning',example:'Concrete walkthrough',complexity:'Time and space complexity',edge_cases:'Edge cases'})[id]);
  return <section className="oral-practice" aria-labelledby={`oral-heading-${session.id}`}><header><div><h3 id={`oral-heading-${session.id}`}>{t('Explain it like an interview.')}</h3><p>{t('Your solution is only half the story. Practice making your reasoning clear.')}</p></div><span>{t('Up to 3 rounds')}</span></header>
    {!oral||oral.status==='finished'?<div className="oral-setup"><label>{t('Interviewer')}<select value={mode} disabled={locked} onChange={e=>setMode(e.target.value)}><option value="coaching">{t('Coaching · Progressive hints')}</option><option value="strict">{t('Strict · No hints')}</option></select></label><button className="secondary-button" disabled={locked||!eligible} onClick={()=>void act('start')}>{t(oral?'Start another oral practice':'Start oral practice · No AI')}</button>{!eligible&&<p>{t('Run the current solution first, then practice explaining that tested version.')}</p>}</div>:null}
    {oral&&<div className="oral-session"><p className="oral-evidence">{t('Saved test evidence: {0} / {1} · {2}',oral.evidence.passed,oral.evidence.total,t(oral.evidence.scope==='hidden_cases'?'Hidden test result':'Public example result'))} · {t(oral.mode==='strict'?'Strict · No hints':'Coaching · Progressive hints')}</p>{stale&&<p role="status">{t('Your code changed. This conversation refers to the earlier tested solution.')}</p>}
      {oral.rounds.map((row,index)=><article className="oral-round" key={index}><h4>{t('Explanation {0}',index+1)}</h4><p>{row.question}</p><blockquote>{row.answer}</blockquote>{row.review&&<div className="oral-review"><p><strong>{t('What you explained well')}</strong> {row.review.strength}</p><ul>{row.review.criteria.map(item=><li key={item.id}><span><strong>{label(item.id)}</strong><small className={`oral-${item.status}`}>{t(({addressed:'Explained',partial:'Needs detail',missing:'Not discussed'})[item.status])}</small></span><p>{item.note}</p></li>)}</ul>{row.review.hint&&oral.status!=='finished'&&index===oral.rounds.length-1&&<p className="oral-coach-hint"><strong>{t('Coaching hint')}</strong> {row.review.hint}</p>}</div>}<small>{row.model} · {t('AI feedback · Review critically')}{row.totalTokens!=null?` · ${t('{0} tokens',row.totalTokens)}`:''}</small></article>)}
      {oral.status==='active'?<div className="oral-answer"><h4>{t('Examiner question')} · {oral.round+1}/3</h4><p className="oral-question">{oral.question}</p><OralQuestionVoice text={oral.question} active={active&&!recording}/>{oral.mode==='strict'&&<p>{t('Strict mode keeps feedback hidden until you finish. The examiner only asks questions.')}</p>}<Microphone key={oral.id+':'+oral.round} value={answer} onChange={editAnswer} disabled={busy} onRecording={setRecording} active={active}/><label htmlFor={`oral-answer-${session.id}`}>{t('Your explanation · Review before sending')}</label><textarea id={`oral-answer-${session.id}`} value={answer} maxLength={4000} disabled={busy} onChange={e=>editAnswer(e.target.value)} placeholder={t('First, I noticed… so I chose… For example…')}/><SpeechTermSuggestions value={answer} onChange={editAnswer} disabled={locked}/><p className="oral-draft-status" role="status">{t(answerSaved?'Your unsent explanation is kept in this browser for this interview round.':'This explanation draft could not be saved. Keep this page open and copy your text before leaving.')}</p><div className="oral-actions"><button className="primary-button" disabled={locked||!answer.trim()} onClick={()=>void act('answer')}>{t('Send explanation · AI credits')}</button><button className="text-button" disabled={locked} onClick={()=>void act('finish')}>{t('Finish and review · No AI')}</button></div><small>{t('Sending uses your explanation, saved solution, public examples and test counts. Hidden test inputs are not sent. Your recording is never submitted automatically.')}</small></div>:<p className="oral-complete" role="status">{t('Practice complete. Review the feedback, then try explaining the idea once more in your own words.')}</p>}
    </div>}{error&&<p role="alert" className="oral-error">{error}</p>}
  </section>;
}
