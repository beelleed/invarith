import {microphoneFailure} from './microphone-support.mjs';
export function createDictation({Recognition,language,onText,onPreview,onState,onError,maxMs=90000}){
 let current=null,generation=0,timer;
 const stop=()=>{generation++;clearTimeout(timer);const old=current;current=null;if(old){old.onresult=old.onend=old.onerror=null;try{old.abort();}catch{}}onPreview('');onState(false);};
 return {stop,start(){if(current)return;const job=++generation;let recognition;try{recognition=new Recognition();}catch{onError('Speech input could not start. You can keep typing.');return;}
  current=recognition;const seen=new Set();recognition.lang=language;recognition.continuous=true;recognition.interimResults=true;
  recognition.onresult=event=>{if(current!==recognition||job!==generation)return;const final=[],interim=[];for(let i=event.resultIndex;i<event.results.length;i++){const result=event.results[i],text=result[0]?.transcript?.trim();if(!text)continue;if(result.isFinal){if(!seen.has(i)){seen.add(i);final.push(text);}}else interim.push(text);}if(final.length)onText(final.join(' '));onPreview(interim.join(' '));};
  recognition.onend=()=>{if(job!==generation)return;clearTimeout(timer);current=null;onState(false);onPreview('');};
  recognition.onerror=event=>{if(job!==generation)return;const message=({'not-allowed':'Microphone permission was not granted. You can keep typing.','service-not-allowed':'This browser’s speech service is unavailable. Try another browser or keep typing.','audio-capture':'No microphone was found. Check your microphone and try again.','network':'The speech service could not connect. Your draft is unchanged.','no-speech':'No speech was detected. Try again when you are ready.'})[event.error];stop();if(event.error!=='aborted')onError(['not-allowed','service-not-allowed','audio-capture'].includes(event.error)?microphoneFailure(event):message||'Speech input stopped. Your draft is unchanged.');};
  try{recognition.start();onState(true);timer=setTimeout(stop,maxMs);}catch{stop();onError('Speech input could not start. You can keep typing.');}
 }};
}
export function editableDictationTarget(element){return Boolean(element?.isConnected&&!element.disabled&&!element.readOnly&&!element.closest('[data-voice-input]')&&(element.tagName==='TEXTAREA'||element.tagName==='INPUT'&&['text','search','url',''].includes(element.type)));}
export function dictationFingerprint(element,scope){const root=element.closest('.ai-practice-workspace,.system-design-interview,.interview-panel');return scope+'|'+(root?.querySelector('.ai-practice-question>h3,.design-task-title,#interview-task-title')?.textContent||'')+'|'+element.id;}
export function insertDictation(element,text,snapshot,scope){
 text=text.trim();
 if(!editableDictationTarget(element)||element.value!==snapshot.value||dictationFingerprint(element,scope)!==snapshot.context)throw Error('The text field changed. Select it again before inserting your speech.');
 const start=Math.max(0,Math.min(snapshot.start,element.value.length)),end=Math.max(start,Math.min(snapshot.end,element.value.length));
 const before=element.value.slice(0,start),after=element.value.slice(end),gap=before&&!/\s$/.test(before)&&text&&!/^\s/.test(text)?' ':'';
 const value=before+gap+text+after;if(element.maxLength>=0&&value.length>element.maxLength)throw Error('This text is too long for the selected field. Shorten it before inserting.');
 const view=element.ownerDocument.defaultView,prototype=element.tagName==='TEXTAREA'?view.HTMLTextAreaElement.prototype:view.HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new view.Event('input',{bubbles:true}));element.focus();element.setSelectionRange((before+gap+text).length,(before+gap+text).length);return value;
}
