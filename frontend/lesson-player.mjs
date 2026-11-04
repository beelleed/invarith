import { solutionDeck } from './solution-deck.mjs';
import { revealWorkspace } from './workspace-layout.mjs';
import { t, locale, language as pageLanguage, preferenceKey, localizePresentation, voiceSettings } from './i18n.mjs';
import { buildWalkthrough } from './walkthrough-data.mjs';
import { drawWalkthrough } from './walkthrough-canvas.mjs';
import { lessonExamples,buildExampleLesson,frameNarration } from './lesson-examples.mjs';
import { narrationSegments,teacherCueAt } from './teacher-storyboards.mjs';
import {practiceLessonInput} from './practice-lesson-input.mjs';

export function initWalkthrough({toast,api,onVerifySolution}){
  const $=id=>document.getElementById(id),node=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;},canvas=$('walkthrough-canvas'),speech=globalThis.speechSynthesis;
  // Page language and speech always agree. Voice choices are remembered per locale.
  $('lesson-language').querySelectorAll('option').forEach(option=>{if(option.value!=='off' && option.value!==pageLanguage.speech)option.remove();});
  $('lesson-language').value=pageLanguage.speech;
  $('lesson-voice-engine').value=locale==='zh-TW'?'kokoro':pageLanguage.engine;
  if(locale==='en'){$('lesson-voice-engine').querySelector('option[value="taiwan"]').hidden=true;document.querySelector('.teacher-voice-settings').hidden=true;}
  let record=null,deck=null,index=0,origin='none',label=t("Saved verification run"),workspace=null,workspaceIndex=0,workspaceKey=null,lastMainIndex=null,currentKey=null,stale=false,playing=false,timer=null,epoch=0,audioLoading=false,preparing=false,voice=null;
  let utterance=null,generatingSolution=false;
  let teacherStep=0,animation=null;const teacherAnswers=new Map();
  const audio=$('lesson-natural-audio');let naturalReady=false;
  const previews=[...document.querySelectorAll('.teacher-voice-settings audio')];
  previews.forEach(sample=>sample.addEventListener('play',()=>{stop(true);previews.filter(other=>other!==sample).forEach(other=>other.pause());render();}));
  const browserVoices=()=>globalThis.speechSynthesis?.getVoices().filter(voice=>voice.localService) || [];
  const voiceAvailability=()=>{const voices=browserVoices(),languages=[voices.some(voice=>voice.lang==='en-US')?'English':null,voices.some(voice=>voice.lang==='zh-TW')?t("Mandarin"):null].filter(Boolean);$('lesson-voice-availability').textContent=naturalReady?t("Kokoro neural voices are ready: English and Mandarin. Generated on this computer; saved audio is reused. No API fee."):t("Kokoro is not ready yet. Browser voice languages: {0}. Captions remain available.", languages.join(', ') || 'checking availability');};
  globalThis.speechSynthesis?.addEventListener('voiceschanged',voiceAvailability);voiceAvailability();
  void api('/api/local-voice').then(status=>{naturalReady=status.ready;voiceAvailability();}).catch(()=>voiceAvailability());
  document.addEventListener('workspace-leave-lesson',()=>{stop();render();});
  function stop(clear=false){playing=false;clearTimeout(timer);timer=null;cancelAnimationFrame(animation);audioLoading=false;if(clear){epoch++;speech?.cancel();utterance=null;voice=null;audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;}else{if(utterance)speech?.pause();audio.pause();}}
  function paintTeaching(){const frame=deck?.frames[index];if(!frame?.teaching)return;const cue=frame.teaching.cues[teacherStep];drawWalkthrough(canvas,deck,index,playing?Math.min(1,Math.max(0,audio.currentTime-(voice?.cueTimes?.[teacherStep] ?? 0))/.8):1,teacherStep);$('teacher-idea').textContent=cue.note;$('teacher-step-status').textContent=t("Idea {0} / {1}", teacherStep+1, frame.teaching.cues.length);$('teacher-previous').disabled=preparing || teacherStep===0;$('teacher-next').disabled=preparing || teacherStep===frame.teaching.cues.length-1;canvas.setAttribute('aria-label',`${frame.title}. ${cue.note}`);}
  function animateTeaching(job){cancelAnimationFrame(animation);const tick=()=>{if(job!==epoch || !playing || !deck?.frames[index]?.teaching)return;paintTeaching();animation=requestAnimationFrame(tick);};animation=requestAnimationFrame(tick);}
  function syncTeaching(){const count=deck?.frames[index]?.teaching?.cues.length;if(!count)return;const step=teacherCueAt(voice?.cueTimes,audio.currentTime,count);if(step!==null)teacherStep=step;$('teacher-sync-note').textContent=step===null?t("Use Previous / Next idea to explore the diagram. Automatic audio alignment is unavailable for this clip."):t("Diagram changes follow the generated speech timing. Use the audio controls to pause or seek.");paintTeaching();}
  function render(){
    const ready=Boolean(deck),frame=deck?.frames[index];$('walkthrough-stage').hidden=!ready;
    const taiwanOption=$('lesson-voice-engine').querySelector('option[value="taiwan"]');taiwanOption.disabled=!(origin==='example'||origin==='generated'&&$('solution-online').checked) || locale!=='zh-TW';
    if(taiwanOption.disabled && $('lesson-voice-engine').value==='taiwan')$('lesson-voice-engine').value='kokoro';
    $('lesson-example-open').disabled=preparing;$('lesson-example').disabled=preparing;$('walkthrough-workspace').disabled=!workspace || preparing;
    $('walkthrough-case').disabled=!ready || preparing || ['example','generated'].includes(origin);
    $('solution-generate').disabled=preparing;
    $('solution-sample').disabled=preparing;
    $('solution-from-intent').disabled=preparing;
    $('solution-problem').disabled=preparing;
    $('solution-online').disabled=preparing;
    document.querySelector('.solution-online-consent').hidden=locale!=='zh-TW';
    for(const id of ['walkthrough-play','walkthrough-restart','walkthrough-seek','lesson-chapters','lesson-language','lesson-voice-engine','lesson-voice-rate'])$(id).disabled=!ready || preparing;
    $('walkthrough-previous').disabled=!ready || preparing || index===0;$('walkthrough-next').disabled=!ready || preparing || index===deck.frames.length-1;
    $('walkthrough-play').textContent=playing?t("Pause lesson"):(utterance && speech?.paused) || (audio.getAttribute('src') && !audio.ended)?t("Resume narration"):t("Watch lesson");
    $('walkthrough-speed').disabled=!ready || preparing || $('lesson-language').value!=='off';
    $('walkthrough-source').textContent=record?`${label} · ${record.submission.functionName} · ${origin==='generated'?t('AI solution lesson · Illustrations and code not executed'):origin==='example'?t("Worked explanation plus real before/after execution"):t('Source {0}',record.evidence.id || t('Not recorded'))}${origin==='workspace' && stale?t(' · Editor changed; this uses the completed source.'):''}`:t("Choose a worked lesson above, or select a completed test with captured events in Trace Explorer.");
    $('walkthrough-status').hidden=!ready&&!preparing;
    $('walkthrough-status').textContent=preparing?(generatingSolution?t("Preparing the teaching script and diagrams. One model request; narration follows when ready."):t("Preparing the example and repaired implementation in local Docker…")):!ready?t('Choose a problem to create a lesson.'):playing?(audioLoading?t("Preparing local chapter narration…"):t('Playing lesson…')):t('Ready to play.');
    $('solution-verification').hidden=origin!=='generated'||!ready||index<3;
    $('solution-verify').disabled=preparing||!onVerifySolution;
    $('solution-rehearsal').hidden=origin!=='generated'||!ready||index!==deck.frames.length-1;
    if(origin==='generated'&&ready)$('solution-rehearsal-text').textContent=deck.context.interviewSummary;
    if(!ready)return;
    teacherStep=Math.min(teacherStep,(frame.teaching?.cues.length || 1)-1);drawWalkthrough(canvas,deck,index,1,teacherStep);canvas.setAttribute('aria-label',`${frame.title}. ${frame.caption}`);
    $('teacher-panel').hidden=!frame.teaching;
    if(frame.teaching){paintTeaching();$('teacher-sync-note').textContent=voice?.cueTimes?t("Diagram changes follow generated speech timing."):t("Each idea has its own diagram. Narrated playback advances the illustration with the explanation.");}
    $('teacher-checkpoint').hidden=!frame.checkpoint;
    if(frame.checkpoint){const chosen=teacherAnswers.get(index);$('teacher-question').textContent=frame.checkpoint.question;$('teacher-choices').replaceChildren(...frame.checkpoint.choices.map((choice,choiceIndex)=>{const button=node('button',choice);button.setAttribute('aria-pressed',String(chosen===choiceIndex));button.addEventListener('click',()=>{teacherAnswers.set(index,choiceIndex);stop();render();});return button;}));$('teacher-feedback').textContent=chosen===undefined?t("Make a prediction. No model call or execution is needed."):`${chosen===frame.checkpoint.correct?t("Yes."):t("Try the range meaning again.")} ${frame.checkpoint.explanation}`;$('teacher-continue').hidden=chosen===undefined;}
    $('walkthrough-count').textContent=frame.teaching?t("Chapter {0}/{1} · Teacher-led lesson · Reasoning before code", index+1, deck.frames.length):t("Chapter {0}/{1} · {2} captured events{3}", index+1, deck.frames.length, deck.capturedEvents, deck.context.partial?t(' · Partial trace'):'');
    $('walkthrough-seek').max=String(deck.frames.length-1);$('walkthrough-seek').value=String(index);
    $('lesson-chapters').replaceChildren(...deck.frames.map((chapter,chapterIndex)=>{const option=node('option',`${chapterIndex+1}. ${chapter.title}`);option.value=String(chapterIndex);return option;}));$('lesson-chapters').value=String(index);
    $('walkthrough-caption').textContent=frame.caption;$('lesson-chapter-title').textContent=frame.title;
    $('walkthrough-timing').textContent=frame.teaching?t("The diagrams explain the idea. The final chapter compares real execution evidence. Pause and predict before revealing the reasoning."):`${deck.context.timingNote} ${deck.context.traceNote}${deck.context.partial?t(' Omitted events cannot be reconstructed.'):''}`;
    $('lesson-narration-text').textContent=$('lesson-language').value==='off'?frameNarration(deck,index,pageLanguage.speech):frameNarration(deck,index,$('lesson-language').value);
    $('lesson-voice-status').textContent=voice?t("{0} · {1} · {2} · {3}0 API tokens", voice.voice, voice.language, voice.engine || t('Browser voice'), voice.cached?t('Saved audio reused · '):''):$('lesson-language').value==='off'?t("Narration off. Captions and diagrams remain available."):$('lesson-voice-engine').value==='taiwan'?t("Taiwan voice: first generation sends public lesson narration to Microsoft; saved audio is reused."):$('lesson-voice-engine').value==='kokoro'?t("Free neural voice. First generation can take a moment; later plays reuse saved audio."):t("Basic browser voice. No API fee.");
    $('lesson-audio-panel').hidden=$('lesson-language').value==='off';
    const formula=$('lesson-formula');formula.hidden=!frame.formula;
    if(frame.formula){const expression=node('p',frame.formula.expression);expression.className='lesson-equation';const definitions=node('dl');for(const [symbol,meaning] of frame.formula.symbols)definitions.append(node('dt',symbol),node('dd',meaning));const steps=node('ol');frame.formula.steps.forEach(step=>steps.append(node('li',step)));formula.replaceChildren(node('h3',t("Formula, symbols, and worked calculation")),expression,definitions,steps);}
    const summary=frame.summary || deck.context.summary,details=[node('p',t("Input: {0}", summary.call)),node('p',t("Expected: {0} · {1}: {2}", summary.expected, summary.status==='error'?t('Observed error'):t('Actual'), summary.actual))];
    if(frame.kind==='event'){const table=node('table');for(const [key,value] of Object.entries(frame.variables)){const row=node('tr');row.append(node('th',key),node('td',value));table.append(row);}details.push(table);for(const change of frame.changes)details.push(node('p',t("Captured preview changed: {0}: {1} → {2}. This is not an assignment claim.", change.name, change.before, change.after)));}
    if(origin==='generated'&&index===deck.frames.length-1){details.push(node('h3',t('Practice this interview explanation')),node('p',deck.context.interviewSummary));}
    details.push(node('pre',frame.code || record.submission.code));$('walkthrough-frame-text').replaceChildren(...details);
  }
  function jump(position){stop(true);teacherStep=0;index=Math.min(Math.max(0,position),deck.frames.length-1);$('lesson-voice-progress').textContent=t("Ready to narrate this chapter.");render();}
  function advance(job){if(job!==epoch || !playing)return;if(deck.frames[index].checkpoint && !teacherAnswers.has(index)){stop();render();$('teacher-checkpoint').scrollIntoView({behavior:'smooth',block:'center'});return;}if(index>=deck.frames.length-1){playing=false;cancelAnimationFrame(animation);render();return;}index++;teacherStep=0;render();void playFrame(job);}
  async function playFrame(job){
    if(job!==epoch || !playing)return;
    const language=$('lesson-language').value;
    if(language==='off'){timer=setTimeout(()=>{if(job!==epoch || !playing)return;const cues=deck.frames[index].teaching?.cues;if(cues && teacherStep<cues.length-1){teacherStep++;render();void playFrame(job);}else advance(job);},Number($('walkthrough-speed').value));render();return;}
    const spoken=frameNarration(deck,index,language);audioLoading=true;$('lesson-voice-progress').textContent=$('lesson-voice-engine').value==='taiwan'?t("Loading saved Taiwan voice, or preparing public lesson narration online…"):t("Starting this chapter’s local voiceover…");render();
    try{
      if(['kokoro','taiwan'].includes($('lesson-voice-engine').value)){
        const taiwan=$('lesson-voice-engine').value==='taiwan';
        const segments=narrationSegments(deck,index,language);
        const result=taiwan?await api('/api/lessons/taiwan-narration',{...(origin==='generated'?{lessonId:deck.lessonId,allowOnline:$('solution-online').checked}:{exampleId:deck.exampleId}),lessonVersion:deck.lessonVersion,chapterIndex:index,voice:$('lesson-taiwan-voice').value}):await api('/api/lessons/narration',{language,text:spoken,...(segments?{segments}:{})});
        if(job!==epoch || !playing)return;
        if(!/^\/api\/(?:taiwan-)?lesson-audio\/[a-f0-9]{64}\.wav$/.test(result.url))throw new Error(t("The voice returned an invalid audio URL."));
        voice=result;audio.src=result.url;audio.playbackRate=Number($('lesson-voice-rate').value);audio.hidden=false;
        previews.forEach(sample=>sample.pause());
        audio.onplay=()=>{if(job===epoch){playing=true;audioLoading=false;syncTeaching();render();animateTeaching(job);}};
        audio.onpause=()=>{if(job===epoch && !audio.ended){playing=false;render();}};
        audio.ontimeupdate=()=>{if(job===epoch && Number.isFinite(audio.duration)){$('lesson-voice-progress').textContent=t("Chapter {0} · {1} / {2} seconds · {3}", index+1, audio.currentTime.toFixed(1), audio.duration.toFixed(1), result.cached?t('Saved audio'):taiwan?t('Taiwan online voice'):t('Generated locally'));syncTeaching();}};
        audio.onended=()=>{if(job===epoch){$('lesson-voice-progress').textContent=t("Chapter narration completed.");advance(job);}};
        audio.onerror=()=>{if(job===epoch){stop(true);toast(t("Saved narration could not be played. Choose Browser voice or captions to continue."),true);render();}};
        try{await audio.play();}catch(error){if(job!==epoch)return;if(error.name==='NotAllowedError'){playing=false;audioLoading=false;toast(t("Press play on the chapter audio controls to start narration."),true);render();return;}throw error;}return;
      }
      const matching=browserVoices().filter(voice=>voice.lang===language),selected=matching.find(voice=>/Zira|Hanhan/.test(voice.name)) || matching[0];
      if(!speech || !selected || typeof globalThis.SpeechSynthesisUtterance!=='function')throw new Error(t("No matching local voice is available. Choose captions only to continue."));
      const request=new SpeechSynthesisUtterance(spoken);utterance=request;request.voice=selected;request.lang=language;request.rate=Number($('lesson-voice-rate').value);
      voice={voice:selected.name,language,modelTokens:0};
      request.onstart=()=>{if(job===epoch){audioLoading=false;$('lesson-voice-progress').textContent=t("Speaking chapter {0}. The lesson advances when the narration finishes.", index+1);render();}};
      request.onboundary=event=>{if(job===epoch && event.name==='word'){$('lesson-voice-progress').textContent=t("Speaking chapter {0} · {1}% of narration.", index+1, Math.min(100,Math.round(event.charIndex/spoken.length*100)));const segments=narrationSegments(deck,index,language);if(segments){let start=0;teacherStep=0;for(let step=0;step<segments.length;step++){if(event.charIndex>=start)teacherStep=step;start+=segments[step].length+1;}paintTeaching();}}};
      request.onend=()=>{if(job!==epoch)return;utterance=null;$('lesson-voice-progress').textContent=t("Chapter narration completed.");advance(job);};
      request.onpause=()=>{if(job===epoch){playing=false;render();}};request.onresume=()=>{if(job===epoch){playing=true;render();}};
      request.onerror=event=>{if(job!==epoch)return;stop(true);toast(t("Local voiceover was interrupted ({0}). Captions remain available.", event.error),true);render();};
      speech.speak(request);
    }catch(error){if(job!==epoch)return;stop(true);toast(error.message,true);render();}
  }
  function play(){if(playing){stop();render();return;}if(audio.getAttribute('src') && !audio.ended){playing=true;void audio.play().catch(()=>{playing=false;toast(t("Press play on the audio controls to resume."),true);render();});render();return;}if(utterance && speech?.paused){playing=true;speech.resume();render();return;}if(index===deck.frames.length-1)jump(0);playing=true;const job=++epoch;void playFrame(job);render();}
  function choices(){const selected=record?.evidence.results || [];$('walkthrough-case').replaceChildren(...selected.map(row=>{const option=node('option',t("Test {0} · {1} · {2} events", row.index+1, t(row.status==='passed'?'Passed':row.status==='failed'?'Mismatch':row.status==='error'?'Error':row.status), row.trace?.length || 0));option.value=String(row.index);option.disabled=!row.trace?.length;return option;}));}
  function setRecord(value,caseIndex,nextOrigin,nextLabel){
    stop(true);teacherStep=0;teacherAnswers.clear();record=JSON.parse(JSON.stringify(value));origin=nextOrigin;label=nextLabel;currentKey=`${nextOrigin}:${record.evidence.id || record.submission.code}`;choices();
    const chosen=record.evidence.results.find(row=>row.index===caseIndex && row.trace?.length) || record.evidence.results.find(row=>row.trace?.length);
    try{deck=localizePresentation(buildWalkthrough(record,chosen?.index ?? caseIndex,label));}catch{deck=null;}index=0;$('walkthrough-case').value=String(chosen?.index ?? caseIndex);render();
  }
  $('walkthrough-nav').addEventListener('click',()=>$('walkthrough-heading').scrollIntoView({behavior:'smooth'}));
  $('walkthrough-workspace').addEventListener('click',()=>{if(workspace)setRecord(workspace,workspaceIndex,'workspace',t("Saved verification run"));});
  $('walkthrough-case').addEventListener('change',()=>setRecord(record,Number($('walkthrough-case').value),origin,label));
  $('walkthrough-previous').addEventListener('click',()=>jump(index-1));$('walkthrough-next').addEventListener('click',()=>jump(index+1));$('walkthrough-restart').addEventListener('click',()=>jump(0));
  $('walkthrough-seek').addEventListener('input',()=>jump(Number($('walkthrough-seek').value)));$('lesson-chapters').addEventListener('change',()=>jump(Number($('lesson-chapters').value)));
  $('walkthrough-play').addEventListener('click',play);$('walkthrough-speed').addEventListener('change',()=>{if(playing){stop();play();}});
  function moveIdea(direction){stop();teacherStep=Math.max(0,Math.min(deck.frames[index].teaching.cues.length-1,teacherStep+direction));if(audio.getAttribute('src') && voice?.cueTimes?.length===deck.frames[index].teaching.cues.length)audio.currentTime=voice.cueTimes[teacherStep];render();}
  $('teacher-previous').addEventListener('click',()=>moveIdea(-1));$('teacher-next').addEventListener('click',()=>moveIdea(1));$('teacher-continue').addEventListener('click',()=>{jump(index+1);play();});
  $('lesson-language').addEventListener('change',()=>{stop(true);if($('lesson-voice-engine').value==='taiwan' && $('lesson-language').value==='en-US')$('lesson-voice-engine').value='kokoro';render();});$('lesson-voice-rate').addEventListener('change',()=>{const wasPlaying=playing;stop(true);if(wasPlaying)play();else render();});
  $('lesson-voice-engine').addEventListener('change',()=>{stop(true);localStorage.setItem(preferenceKey('invarith-lesson-voice-engine'),$('lesson-voice-engine').value);if($('lesson-voice-engine').value==='taiwan')$('lesson-language').value='zh-TW';render();});
  const savedTaiwanVoice=localStorage.getItem(preferenceKey('invarith-taiwan-voice')) || (locale==='zh-TW'?localStorage.getItem('invarith-taiwan-voice'):null);if(['zh-TW-HsiaoChenNeural','zh-TW-HsiaoYuNeural'].includes(savedTaiwanVoice))$('lesson-taiwan-voice').value=savedTaiwanVoice;
  $('lesson-taiwan-voice').addEventListener('change',()=>{localStorage.setItem(preferenceKey('invarith-taiwan-voice'),$('lesson-taiwan-voice').value);localStorage.setItem(preferenceKey('invarith-lesson-voice-engine'),'taiwan');if(origin==='example'||origin==='generated'&&$('solution-online').checked){stop(true);$('lesson-voice-engine').value='taiwan';$('lesson-language').value='zh-TW';render();toast(t("Taiwan voice selected. Press Watch lesson to listen."));}});
  $('solution-verify').addEventListener('click',()=>{if(preparing||origin!=='generated'||!deck||!onVerifySolution)return;const imported=onVerifySolution({id:deck.lessonId,title:deck.context.lessonTitle,problem:deck.context.summary.call,code:deck.context.repairCode});if(imported)stop();});
  $('solution-sample').addEventListener('click',()=>{practiceVisualKind='auto';$('solution-problem').value=locale==='zh-TW'?'給定一個已由小到大排序的整數陣列 nums 和整數 target，找出兩個不同索引，使對應數字相加等於 target。回傳這兩個從 0 開始的索引；沒有解則回傳 []。可以假設最多一組解。例子：nums = [1, 2, 4, 6, 9]，target = 8，應回傳 [1, 3]。請說明為什麼可以用左右指針，以及每次移動的理由。':'Given an ascending sorted integer array nums and integer target, return the zero-based indices of two distinct elements whose sum equals target, or [] if no pair exists. Assume at most one solution. Example: nums = [1, 2, 4, 6, 9], target = 8 gives [1, 3]. Explain why two pointers work and justify each move.';});
  $('solution-from-intent').addEventListener('click',()=>{practiceVisualKind='auto';$('solution-problem').value=document.getElementById('intent').value;});
  $('solution-online').addEventListener('change',()=>{if(origin==='generated'){stop(true);$('lesson-voice-engine').value=locale==='zh-TW'&&$('solution-online').checked?'taiwan':'kokoro';render();}});
  let practiceVisualKind='auto';
  document.addEventListener('library-problem-selected',()=>{practiceVisualKind='auto';});
  $('solution-problem').addEventListener('input',()=>{practiceVisualKind='auto';});
  async function generateSolution(){
    if(preparing)return;
    if(!$('solution-problem').value.trim()){toast(t('Enter the complete problem first.'),true);return;}
    stop(true);preparing=true;generatingSolution=true;render();$('solution-progress').textContent=t('Preparing the teaching script and diagrams. One model request; narration follows when ready.');
    try{
      const lesson=await api('/api/lessons/generate',{problem:$('solution-problem').value,language:pageLanguage.speech,visualKind:practiceVisualKind});
      $('solution-assumptions').hidden=false;$('solution-assumptions').replaceChildren(node('h4',t('Assumptions to confirm')), ...lesson.assumptions.map(value=>node('p',value)));
      deck=solutionDeck(lesson);record={submission:{functionName:lesson.algorithm,code:'',cases:[]},evidence:{id:lesson.id,results:[]}};origin='generated';label=lesson.title;index=0;teacherStep=0;teacherAnswers.clear();voice=null;choices();
      const config=voiceSettings(locale,'generated');$('lesson-language').value=config.speech;$('lesson-voice-engine').value=locale==='zh-TW'&&$('solution-online').checked?'taiwan':'kokoro';
      $('solution-progress').textContent=t(lesson.cached?'Saved lesson ready.':'Lesson ready.');if($('solution-generation-details'))$('solution-generation-details').textContent=t('{0} · {1} tokens · {2}',lesson.model,lesson.totalTokens??'?',lesson.cached?t('Saved lesson reused'):t('Lesson generated'));
      preparing=false;render();$('walkthrough-stage').scrollIntoView({block:'start'});play();
    }catch(error){$('solution-progress').textContent=t(error.message);toast(t(error.message),true);}finally{preparing=false;generatingSolution=false;render();}
  }
  $('solution-generate').addEventListener('click',()=>void generateSolution());
  document.addEventListener('practice-lesson-requested',event=>{
    const detail=event.detail;if(preparing||!detail||typeof detail.contract!=='string'||!Array.isArray(detail.examples))return;
    event.preventDefault();
    let transfer;try{transfer=practiceLessonInput(detail,pageLanguage.speech);}catch(error){toast(t(error.message),true);return;}
    $('solution-problem').value=transfer.problem;
    practiceVisualKind=detail.topic==='tree'?'tree':['bfs','dfs','topo','union','shortest','linked'].includes(detail.topic)?'graph':'auto';
    revealWorkspace('solution-generator-title');
    if(transfer.omittedExamples)toast(t('The complete question was preserved. {0} oversized examples were not included in the lesson request.',transfer.omittedExamples));
    void generateSolution();
  });
  $('lesson-example').replaceChildren(...lessonExamples.map(example=>{const option=node('option',t(example.title));option.value=example.id;return option;}));$('lesson-example').value='binary-last';
  $('lesson-example-open').addEventListener('click',async()=>{
    if(preparing)return;stop(true);teacherStep=0;teacherAnswers.clear();preparing=true;let opened=false;render();
    try{const report=await api('/api/lessons/example',{exampleId:$('lesson-example').value,execution:'docker'});deck=localizePresentation(buildExampleLesson(report));record=JSON.parse(JSON.stringify(report.before));origin='example';label=t(deck.context.lessonTitle);currentKey=`example:${report.exampleId}`;index=0;choices();$('walkthrough-case').value=String(deck.context.caseIndex);opened=true;toast(report.cached?t("Saved worked lesson reopened. No new execution."):t("Example and repair were executed. The lesson is ready to watch."));}
    catch(error){toast(error.message,true);}finally{preparing=false;render();}
    if(opened){const config=voiceSettings(locale,'example',localStorage.getItem(preferenceKey('invarith-lesson-voice-engine')));$('lesson-voice-engine').value=config.engine;$('lesson-language').value=config.speech;play();}
  });
  render();return {
    syncWorkspace(value,caseIndex,editorChanged){workspace=value;workspaceIndex=caseIndex;stale=editorChanged;const key=value?String(value.evidence.id || value.submission.code):null,changedIndex=lastMainIndex!==caseIndex;lastMainIndex=caseIndex;
      if(origin==='workspace'){if(!value && currentKey!==null){stop(true);record=null;deck=null;currentKey=null;}else if(value && (workspaceKey!==key || changedIndex || !record))setRecord(value,caseIndex,'workspace',t("Saved verification run"));}workspaceKey=key;render();},
    openEvaluation(value,caseIndex,sourceLabel){revealWorkspace('walkthrough-heading');setRecord(value,caseIndex,'interview',sourceLabel);$('walkthrough-heading').scrollIntoView({behavior:'smooth',block:'start'});},
  };
}
