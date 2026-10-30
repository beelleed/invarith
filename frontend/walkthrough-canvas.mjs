import { t } from './i18n.mjs';
import { drawTeacherScene } from './teacher-canvas.mjs';
const shorten=(context,text,width)=>{const points=Array.from(String(text ?? '')),limited=points.slice(0,600);if(points.length<=600 && context.measureText(limited.join('')).width<=width)return limited.join('');let low=0,high=limited.length;while(low<high){const middle=Math.ceil((low+high)/2);if(context.measureText(limited.slice(0,middle).join('')+'…').width<=width)low=middle;else high=middle-1;}return limited.slice(0,low).join('')+'…';};
function wrapped(context,text,x,y,width,lineHeight,maxLines){
  const content=String(text),cjk=/[\u3400-\u9fff]/.test(content),words=cjk?Array.from(content):content.split(/\s+/),lines=[];let line='';
  for(const word of words){const next=line?`${line}${cjk?'':' '}${word}`:word;if(line && context.measureText(next).width>width){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);
  lines.slice(0,maxLines).forEach((line,index)=>context.fillText(shorten(context,line+(index===maxLines-1 && lines.length>maxLines?' …':''),width),x,y+index*lineHeight));
}
export function drawWalkthrough(canvas,deck,index,progress=0,teachingStep=0){
  if(deck.frames[index]?.teaching){drawTeacherScene(canvas,deck,index,{step:teachingStep,motion:progress});return;}
  const ctx=canvas.getContext('2d'),frame=deck.frames[index],meta=deck.context;if(!ctx || !frame)return;const summary=frame.summary || meta.summary;
  ctx.fillStyle='#f4f7ef';ctx.fillRect(0,0,1280,720);ctx.fillStyle='#203d31';ctx.fillRect(0,0,1280,88);
  ctx.fillStyle='#eff9e9';ctx.font='bold 27px system-ui, sans-serif';ctx.fillText(t("INVARITH / DEBUGGING WALKTHROUGH"),32,39);ctx.font='15px system-ui, sans-serif';ctx.fillText(shorten(ctx,`${frame.evidenceLabel || meta.sourceLabel} · ${t('Test {0}',meta.caseIndex+1)} · ${frame.formula?t('Authored formula explanation'):t('Saved execution evidence')}`,1000),32,66);
  ctx.textAlign='right';ctx.fillText(`${index+1} / ${deck.frames.length}`,1248,39);ctx.textAlign='left';
  ctx.fillStyle='#fff';ctx.fillRect(32,108,754,414);ctx.fillRect(804,108,444,414);
  ctx.fillStyle='#345944';ctx.font='bold 17px system-ui, sans-serif';ctx.fillText(shorten(ctx,summary.call,710),50,140);
  const source=(frame.code || meta.code).split('\n'),line=Number.isInteger(frame.line)?frame.line:1,start=Math.max(0,Math.min(line-5,source.length-11)),end=Math.min(source.length,start+11);
  ctx.font='17px ui-monospace, Consolas, monospace';
  if(frame.formula){ctx.font='bold 25px system-ui, sans-serif';ctx.fillStyle='#263e31';wrapped(ctx,frame.formula.expression,50,188,710,32,2);ctx.font='17px system-ui, sans-serif';let y=250;for(const step of frame.formula.steps.slice(0,4)){wrapped(ctx,step,50,y,710,24,2);y+=58;}}
  else for(let offset=start;offset<end;offset++){const y=183+(offset-start)*27;if(offset+1===line){ctx.fillStyle='#d9edcf';ctx.fillRect(42,y-21,734,27);}ctx.fillStyle='#718174';ctx.fillText(String(offset+1),50,y);ctx.fillStyle='#263e31';ctx.fillText(shorten(ctx,source[offset] || ' ',662),92,y);}
  ctx.fillStyle='#647568';ctx.font='12px system-ui, sans-serif';ctx.fillText(frame.formula?t("Worked calculation; read full definitions below."):t("Source window and long lines may be abbreviated."),50,508);
  const entries=frame.kind==='event' || frame.formula?Object.entries(frame.variables):[[t("Input"),summary.call],[t("Expected"),summary.expected],[summary.status==='error'?t("Observed error"):t("Actual"),summary.actual],[t('Outcome'),summary.outcome]];
  ctx.fillStyle='#345944';ctx.font='bold 17px system-ui, sans-serif';ctx.fillText(frame.kind==='event'?t("Captured local previews"):frame.formula?t("What each symbol means"):t("Completed test evidence"),824,140);
  entries.slice(0,6).forEach(([key,value],offset)=>{const y=175+offset*52;ctx.font='bold 13px system-ui, sans-serif';ctx.fillStyle=frame.changes.some(item=>item.name===key)?'#995d36':'#536c5b';ctx.fillText(shorten(ctx,key,400),824,y);ctx.font='16px ui-monospace, Consolas, monospace';ctx.fillStyle='#263e31';ctx.fillText(shorten(ctx,value,400),824,y+23);});
  if(!entries.length){ctx.fillStyle='#647568';ctx.font='15px system-ui, sans-serif';ctx.fillText(t("No locals captured at this event."),824,184);}
  ctx.font='12px system-ui, sans-serif';ctx.fillStyle='#647568';ctx.fillText(frame.kind==='event'?t("Showing {0}/{1} bounded previews.", Math.min(entries.length,6), entries.length):t("Expectations are supplied, not independent proof."),824,508);
  ctx.fillStyle='#e8efe2';ctx.fillRect(32,540,1216,118);ctx.fillStyle='#253e2f';ctx.font='bold 21px system-ui, sans-serif';ctx.fillText(shorten(ctx,frame.title,1176),50,572);ctx.font='17px system-ui, sans-serif';wrapped(ctx,frame.caption,50,601,1176,23,2);
  ctx.fillStyle='#536c5b';ctx.font='12px system-ui, sans-serif';const flags=[['formula','explanation'].includes(frame.kind)?t('CURATED EXPLANATION'):meta.partial?t('PARTIAL TRACE'):t('SAVED EXECUTION EVIDENCE'),meta.videoExcerpt?t('VIDEO EXCERPT'):null,meta.timingNote].filter(Boolean).join(' · ');ctx.fillText(shorten(ctx,flags,1210),32,680);ctx.fillText(shorten(ctx,meta.videoNote || `${t('Source {0}',frame.sourceId || meta.sourceId)} · ${frame.createdAt || meta.createdAt}`,1210),32,700);
  ctx.fillStyle='#cbdcc4';ctx.fillRect(32,710,1216,4);ctx.fillStyle='#47825a';ctx.fillRect(32,710,1216*((index+Math.min(1,Math.max(0,progress)))/deck.frames.length),4);
}

export function supportedWebM(canvas,Recorder=globalThis.MediaRecorder){
  if(typeof canvas.captureStream!=='function' || typeof Recorder!=='function' || typeof Recorder.isTypeSupported!=='function')return null;
  return ['video/webm;codecs=vp8','video/webm'].find(type=>Recorder.isTypeSupported(type)) || null;
}

export async function recordWalkthrough(canvas,deck,{signal,onProgress=()=>{}}={}){
  if(!deck.frames.length || deck.frames.length>20 || deck.context.videoSecondsPerFrame!==2)throw new Error('Video recording supports at most 20 lesson frames at two seconds each.');
  const mimeType=supportedWebM(canvas);if(!mimeType)throw new Error('This browser cannot record the WebM lesson. Interactive playback is still available.');
  const chunks=[];let bytes=0,stream,recorder,timer,timeout;
  return new Promise((resolve,reject)=>{
    let settled=false,start,completed=false;
    const cleanup=()=>{clearInterval(timer);clearTimeout(timeout);signal?.removeEventListener('abort',abort);stream?.getTracks().forEach(track=>track.stop());};
    const fail=error=>{if(settled)return;settled=true;if(recorder?.state==='recording')recorder.stop();cleanup();reject(error);};
    const abort=()=>fail(new Error('Lesson recording was cancelled. No completed video was produced.'));
    if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
    try{
      drawWalkthrough(canvas,deck,0);stream=canvas.captureStream(10);recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1500000});
      recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);bytes+=event.data.size;if(bytes>20000000)fail(new Error('Video size limit reached. No completed video was produced.'));}};
      recorder.onerror=()=>fail(new Error('The browser could not encode this lesson. Interactive playback remains available.'));
      recorder.onstop=()=>{if(settled)return;if(!completed){fail(new Error('Recording stopped before the lesson completed. No completed video was produced.'));return;}settled=true;cleanup();const blob=new Blob(chunks,{type:mimeType});if(!blob.size){reject(new Error('The browser returned an empty recording.'));return;}onProgress(100);resolve(blob);};
      recorder.onstart=()=>{if(settled || signal?.aborted)return;start=performance.now();const frameMs=deck.context.videoSecondsPerFrame*1000,totalMs=frameMs*deck.frames.length;timer=setInterval(()=>{if(settled)return;const elapsed=performance.now()-start;if(elapsed>totalMs+4000){fail(new Error('Recording timing was interrupted. Keep the tab active and try again; no completed video was produced.'));return;}const index=Math.min(deck.frames.length-1,Math.floor(elapsed/frameMs));drawWalkthrough(canvas,deck,index,(elapsed%frameMs)/frameMs);onProgress(Math.min(99,Math.floor(elapsed/totalMs*100)));if(elapsed>=totalMs){completed=true;clearInterval(timer);recorder.stop();}},100);};
      timeout=setTimeout(()=>fail(new Error('The recording time limit was reached. No completed video was produced.')),50000);recorder.start(500);
    }catch{fail(new Error('The browser could not start recording this lesson.'));}
  });
}
