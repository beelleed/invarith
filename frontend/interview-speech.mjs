import {microphoneFailure,microphoneGuide} from './microphone-support.mjs';
import {t,language as pageLanguage} from './i18n.mjs';
export function initInterviewSpeech(root,{api,getContext,getAnswer,setAnswer}){
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  root.className='interview-speech';root.append(el('h3',t('Speak with your interviewer')));
  const engine=el('select');engine.setAttribute('aria-label',t('Interviewer voice'));for(const[id,label]of [['local','Local neural voice · No model credits'],['browser','Browser voice']]){const option=el('option',t(label));option.value=id;engine.append(option);}engine.value=pageLanguage.speech==='zh-TW'?'browser':'local';
  const read=el('button',t('Hear the question')),stop=el('button',t('Stop voice')),audio=el('audio'),mic=el('button',t('Start microphone')),stopMic=el('button',t('Stop microphone')),status=el('p'),interim=el('p');audio.controls=true;audio.hidden=true;status.setAttribute('role','status');interim.setAttribute('aria-live','polite');
  const consentLabel=el('label'),consent=el('input');consent.type='checkbox';consentLabel.append(consent,document.createTextNode(t('I understand my browser may send microphone audio to its speech service.')));
  const controls=el('div');controls.className='interview-board-controls';controls.append(engine,read,stop);const microphones=el('div');microphones.className='interview-board-controls';microphones.append(mic,stopMic);root.append(controls,audio,consentLabel,microphones,status,interim,el('small',t('Recognized text is added to your draft. Review it before submitting; it is never submitted automatically.')));
  const help=el('details'),helpTitle=el('summary',t('Microphone not working?'));help.className='microphone-help';help.append(helpTitle,el('p',t(microphoneGuide)));root.append(help);
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,recording=false,reading=false,epoch=0,key=null,enabled=false,micTimer=null,utterance=null;
  function buttons(){const context=getContext();read.disabled=!context?.question||reading||recording;stop.disabled=!reading;mic.disabled=!Recognition||!enabled||!consent.checked||recording||reading;stopMic.disabled=!recording;engine.disabled=reading||recording;if(!Recognition&&!recording)status.textContent=t('Microphone transcription is unavailable in this browser. You can type your answer.');}
  function stopReading(){epoch++;reading=false;audio.pause();audio.removeAttribute('src');audio.hidden=true;if(utterance){window.speechSynthesis?.cancel();utterance=null;}buttons();}
  function stopRecording(abort=false){window.clearTimeout(micTimer);micTimer=null;const current=recognition;recognition=null;recording=false;if(current){current.onresult=null;current.onend=null;current.onerror=null;try{abort?current.abort():current.stop();}catch{}}interim.textContent='';buttons();}
  read.addEventListener('click',async()=>{
    const context=getContext();if(!context?.question||recording||reading)return;stopReading();const job=epoch;reading=true;buttons();status.textContent=t('Preparing the question voice…');
    try{
      if(engine.value==='local'){
        const clip=await api('/api/lessons/narration',{text:context.question,language:pageLanguage.speech});if(job!==epoch)return;if(!/^\/api\/lesson-audio\/[a-f0-9]{64}\.wav$/.test(clip.url))throw Error('Invalid narration audio.');audio.src=clip.url;audio.hidden=false;audio.onended=()=>{reading=false;buttons();};await audio.play();status.textContent=t('Playing the interviewer question.');
      }else{
        if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)throw Error('Browser voice is unavailable.');
        utterance=new window.SpeechSynthesisUtterance(context.question);utterance.lang=pageLanguage.speech;
        const voices=window.speechSynthesis.getVoices(),matching=voices.filter(v=>v.lang?.toLowerCase()===pageLanguage.speech.toLowerCase());
        utterance.voice=matching.find(v=>/HsiaoChen/i.test(v.name))||matching.find(v=>v.localService)||matching[0]||voices.find(v=>v.lang?.toLowerCase().startsWith(pageLanguage.speech.slice(0,2)))||null;
        utterance.onend=()=>{reading=false;utterance=null;buttons();};utterance.onerror=()=>{reading=false;status.textContent=t('Voice playback failed. The question remains available as text.');buttons();};window.speechSynthesis.speak(utterance);status.textContent=t('Playing the interviewer question.');
      }
    }catch(e){if(job===epoch){reading=false;status.textContent=t(e.message);buttons();}}
  });
  audio.onplay=()=>{if(recording)stopRecording(true);reading=true;buttons();};audio.onpause=()=>{reading=false;buttons();};
  stop.addEventListener('click',stopReading);consent.addEventListener('change',()=>{if(!consent.checked)stopRecording(true);buttons();});
  mic.addEventListener('click',()=>{
    if(!Recognition||!enabled||!consent.checked||recording||reading)return;
    window.dispatchEvent(new Event('invarith-stop-microphone'));const contextKey=key,processed=new Set();let current;try{current=new Recognition();}catch{status.textContent=t(microphoneFailure({name:'NotAllowedError'}));return;}recognition=current;current.lang=pageLanguage.speech;current.continuous=true;current.interimResults=true;recording=true;
    current.onresult=event=>{
      if(key!==contextKey||current!==recognition||!enabled)return;
      const final=[],pending=[];for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i],text=result[0]?.transcript?.trim()||'';if(result.isFinal){if(!processed.has(i)){processed.add(i);final.push(text);}}else pending.push(text);}
      if(final.length){const answer=[getAnswer(),...final].filter(Boolean).join(' ');setAnswer(answer.slice(0,4000));if(answer.length>4000)status.textContent=t('The answer limit is reached. Edit the draft before submitting.');}interim.textContent=pending.join(' ');
    };
    current.onerror=event=>{stopRecording(true);status.textContent=t(microphoneFailure(event));};
    current.onend=()=>{if(current===recognition){window.clearTimeout(micTimer);recognition=null;recording=false;interim.textContent='';status.textContent=t('Microphone stopped. Review your draft before submitting.');buttons();}};
    try{current.start();status.textContent=t('Listening… Stop when you finish your explanation.');micTimer=window.setTimeout(()=>{if(current===recognition){try{current.stop();}catch{stopRecording(true);}}},60000);}catch{stopRecording(true);status.textContent=t('Microphone transcription failed. You can type your answer.');}buttons();
  });
  stopMic.addEventListener('click',()=>{window.clearTimeout(micTimer);if(recognition){try{recognition.stop();}catch{stopRecording(true);}}});
  const close=()=>{stopRecording(true);stopReading();};window.addEventListener('invarith-stop-microphone',()=>stopRecording(true));window.addEventListener('pagehide',close,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});document.addEventListener('workspace-view-changed',event=>{if(event.detail.mode!=='interview')close();});
  return {sync(canRecord){const context=getContext(),next=context?`${context.id}:${context.token}:${context.status}`:null;if(next!==key||!canRecord&&recording){close();key=next;}enabled=Boolean(canRecord);buttons();},close};
}
