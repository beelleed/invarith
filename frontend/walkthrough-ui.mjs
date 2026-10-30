import { t } from './i18n.mjs';
import { buildWalkthrough,videoStoryboard } from './walkthrough-data.mjs';
import { drawWalkthrough,recordWalkthrough,supportedWebM } from './walkthrough-canvas.mjs';

export function initWalkthrough({toast}){
  const $=id=>document.getElementById(id),node=(tag,text)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;return value;};
  const canvas=$('walkthrough-canvas');let record=null,origin='workspace',label='Saved verification run',deck=null,index=0,timer=null,controller=null,videoUrl=null,workspace=null,workspaceIndex=0,workspaceKey=null,currentKey=null,lastMainIndex=null,stale=false;
  const stop=()=>{clearInterval(timer);timer=null;};
  const discardVideo=()=>{if(videoUrl){$('walkthrough-video').pause();$('walkthrough-video').removeAttribute('src');$('walkthrough-video').load();URL.revokeObjectURL(videoUrl);videoUrl=null;}$('walkthrough-video-result').hidden=true;};
  function render(){
    const ready=Boolean(deck),recording=Boolean(controller);$('walkthrough-stage').hidden=!ready;$('walkthrough-record').disabled=!ready || recording || !supportedWebM(canvas);$('walkthrough-cancel').hidden=!recording;
    for(const id of ['walkthrough-play','walkthrough-restart','walkthrough-speed','walkthrough-seek','walkthrough-case'])$(id).disabled=!ready || recording;
    $('walkthrough-previous').disabled=!ready || recording || index===0;$('walkthrough-next').disabled=!ready || recording || index===deck.frames.length-1;
    $('walkthrough-play').textContent=timer?t("Pause lesson"):t("Play lesson");$('walkthrough-workspace').disabled=!workspace || recording;
    $('walkthrough-source').textContent=record?t("{0} · {1} · Source {2}{3}", label, record.submission.functionName, record.evidence.id || 'Not recorded', origin==='workspace' && stale?' · Editor changed: replay uses the completed source.':''):t("Select a completed test with captured events in Trace Explorer, or open a finished interview evaluation.");
    if(!ready){$('walkthrough-status').textContent=t("No captured function trace is selected. A syntax/module error can have an observed result without a replayable function path.");return;}
    const frame=deck.frames[index];drawWalkthrough(canvas,deck,index);canvas.setAttribute('aria-label',`${frame.title}. ${frame.caption}`);
    $('walkthrough-count').textContent=t("Frame {0}/{1} · {2} captured events{3}", index+1, deck.frames.length, deck.capturedEvents, deck.context.partial?' · PARTIAL TRACE':'');
    $('walkthrough-seek').max=String(deck.frames.length-1);$('walkthrough-seek').value=String(index);
    $('walkthrough-caption').textContent=`${frame.title}. ${frame.caption}`;
    $('walkthrough-timing').textContent=`${deck.context.timingNote} ${deck.context.traceNote}${deck.context.partial?' Capture limit reached; omitted events cannot be reconstructed.':''}`;
    const details=[node('p',t("Input: {0}", deck.context.summary.call)),node('p',t("Expected: {0} · {1}: {2}", deck.context.summary.expected, deck.context.summary.status==='error'?'Observed error':'Actual', deck.context.summary.actual))];
    if(frame.kind==='event'){
      const table=node('table');for(const [key,value] of Object.entries(frame.variables)){const row=node('tr');row.append(node('th',key),node('td',value));table.append(row);}details.push(table);
      if(frame.exception)details.push(node('p',t("Raised: {0}; consult the final outcome to determine test status.", frame.exception)));
      if(Object.hasOwn(frame,'value'))details.push(node('p',t("Return/unwind preview: {0}", frame.value)));
      for(const change of frame.changes)details.push(node('p',t("Preview changed since the preceding captured event: {0}: {1} → {2}. Captures may cross function frames.", change.name, change.before, change.after)));
    }
    details.push(node('pre',record.submission.code));$('walkthrough-frame-text').replaceChildren(...details);
    if(!recording){const story=videoStoryboard(deck);$('walkthrough-status').textContent=supportedWebM(canvas)?t("Interactive lesson ready. Video: {0} frames × 2 seconds (about {1}s). {2}", story.frames.length, story.frames.length*2, story.context.videoNote):t("Interactive lesson ready. This browser does not support WebM recording.");}
  }
  function selectCase(caseIndex){
    stop();controller?.abort();controller=null;discardVideo();index=0;
    try{deck=buildWalkthrough(record,caseIndex,label);}catch{deck=null;}
    $('walkthrough-case').value=String(caseIndex);render();
  }
  function setRecord(value,caseIndex,nextOrigin,nextLabel){
    stop();controller?.abort();controller=null;record=JSON.parse(JSON.stringify(value));origin=nextOrigin;label=nextLabel;
    currentKey=`${nextOrigin}:${record.evidence.id || record.submission.code}`;
    $('walkthrough-case').replaceChildren(...record.evidence.results.map(row=>{const option=node('option',t("Test {0} · {1} · {2} captured events", row.index+1, row.status, row.trace?.length || 0));option.value=String(row.index);option.disabled=!row.trace?.length;return option;}));
    const chosen=record.evidence.results.find(row=>row.index===caseIndex && row.trace?.length) || record.evidence.results.find(row=>row.trace?.length);
    selectCase(chosen?.index ?? caseIndex);
  }
  $('walkthrough-workspace').addEventListener('click',()=>{if(workspace)setRecord(workspace,workspaceIndex,'workspace','Saved verification run');});
  $('walkthrough-nav').addEventListener('click',()=>$('walkthrough-heading').scrollIntoView({behavior:'smooth'}));
  $('walkthrough-case').addEventListener('change',()=>selectCase(Number($('walkthrough-case').value)));
  $('walkthrough-previous').addEventListener('click',()=>{stop();index=Math.max(0,index-1);render();});$('walkthrough-next').addEventListener('click',()=>{stop();index=Math.min(deck.frames.length-1,index+1);render();});
  $('walkthrough-restart').addEventListener('click',()=>{stop();index=0;render();});
  $('walkthrough-seek').addEventListener('input',()=>{stop();index=Number($('walkthrough-seek').value);render();});
  const play=()=>{if(timer){stop();render();return;}if(index===deck.frames.length-1)index=0;timer=setInterval(()=>{index++;if(index>=deck.frames.length-1){index=deck.frames.length-1;stop();}render();},Number($('walkthrough-speed').value));render();};
  $('walkthrough-play').addEventListener('click',play);$('walkthrough-speed').addEventListener('change',()=>{if(timer){stop();play();}});
  $('walkthrough-cancel').addEventListener('click',()=>controller?.abort());
  $('walkthrough-record').addEventListener('click',async()=>{
    if(!deck || controller)return;stop();discardVideo();const story=videoStoryboard(deck),recordingCanvas=document.createElement('canvas');recordingCanvas.width=1280;recordingCanvas.height=720;
    const job=new AbortController();controller=job;render();$('walkthrough-status').textContent=t("Recording the saved lesson locally: 0%. Keep this tab active. No camera, microphone, execution, or model call.");
    try{
      const blob=await recordWalkthrough(recordingCanvas,story,{signal:job.signal,onProgress:percent=>{$('walkthrough-status').textContent=t("Recording saved evidence: {0}%. Keep this tab active. No model or code execution.", percent);}});
      if(job.signal.aborted)return;videoUrl=URL.createObjectURL(blob);$('walkthrough-video').src=videoUrl;$('walkthrough-download').href=videoUrl;
      $('walkthrough-download').download=`invarith-lesson-${String(story.context.sourceId).replace(/[^A-Za-z0-9_-]/g,'').slice(0,48)}-test-${story.context.caseIndex+1}.webm`;
      $('walkthrough-video-info').textContent=t("WebM video ready · {0} KB · Silent English captions · {1}", Math.ceil(blob.size/1024), story.context.videoNote);$('walkthrough-video-result').hidden=false;
      toast(t("Lesson video is ready. Preview it or select Download WebM. No model credits were used."));
    }catch(error){toast(error.message,!job.signal.aborted);}finally{if(controller===job)controller=null;render();}
  });
  render();
  return {
    syncWorkspace(value,caseIndex,editorChanged){
      workspace=value;workspaceIndex=caseIndex;stale=editorChanged;const key=value?String(value.evidence.id || value.submission.code):null,changedIndex=lastMainIndex!==caseIndex;lastMainIndex=caseIndex;
      if(origin==='workspace'){
        if(!value){if(currentKey!==null){stop();controller?.abort();controller=null;discardVideo();record=null;deck=null;currentKey=null;}}
        else if(workspaceKey!==key || changedIndex || !record)setRecord(value,caseIndex,'workspace','Saved verification run');
      }
      workspaceKey=key;render();
    },
    openEvaluation(value,caseIndex,sourceLabel){setRecord(value,caseIndex,'interview',sourceLabel);$('walkthrough-heading').scrollIntoView({behavior:'smooth',block:'start'});},
  };
}
