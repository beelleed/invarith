import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile,stat,rename,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from './verification.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export function createVoiceWorker({python=join(root,'.venv-tts',process.platform==='win32'?'Scripts/python.exe':'bin/python'),script=join(root,'backend/local-voice.py')}={}){
  let child=null,pending=null,idle=null;
  function stop(){clearTimeout(idle);if(child){const current=child;child=null;current.kill();}if(pending){const job=pending;pending=null;clearTimeout(job.timeout);job.reject(new AppError(503,'The local speech worker stopped. Captions and browser voices remain available.'));}}
  function start(){
    child=spawn(python,['-u',script],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe'],shell:false});const current=child;
    const lines=createInterface({input:child.stdout});
    lines.on('line',line=>{let data;try{data=JSON.parse(line);}catch{return;}if(!pending || data.id!==pending.id)return;const job=pending;pending=null;clearTimeout(job.timeout);if(data.error)job.reject(new AppError(503,data.error));else job.resolve(data);idle=setTimeout(stop,180000);idle.unref();});
    // Library logs never enter HTTP responses; narration text stays in the local worker.
    child.stderr.resume();
    const fail=()=>{if(child===current)stop();};child.on('error',fail);child.on('exit',fail);child.stdin.on('error',fail);
  }
  return {close:stop,async render(request){if(pending)throw new AppError(429,'Another local narration is being prepared. Try again shortly.');clearTimeout(idle);if(!child)start();return new Promise((resolve,reject)=>{const id=randomUUID(),timeout=setTimeout(()=>{if(pending?.id===id)stop();},120000);pending={id,resolve,reject,timeout};child.stdin.write(JSON.stringify({...request,id})+'\n');});}};
}

export function createLocalVoice({directory=join(root,'data/local-voice'),renderer,namespace,voiceChoices,worker=createVoiceWorker()}={}){
  const pending=new Map(),audioDirectory=join(directory,'audio');let active=false;
  const render=renderer || (request=>worker.render(request));
  const keyFor=(language,text,voice,segments)=>createHash('sha256').update(JSON.stringify(namespace?[namespace,language,voice,text,...(segments?[segments]:[])]:[language==='zh-TW'?'kokoro-local-v1.1-zh-phrasing-v2':'kokoro-local-v1.1-zh-voice-v1',language,text,...(segments?[segments]:[])])).digest('hex');
  const metadata=async id=>{try{return JSON.parse(await readFile(join(audioDirectory,`${id}.json`),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw new AppError(503,'Saved narration metadata could not be read.');}};
  return {
    close:()=>worker.close(),
    async health(){try{const ready=JSON.parse(await readFile(join(directory,'ready.json'),'utf8'));return {ready:ready.version===1,engine:'Kokoro · Local CPU',languages:ready.languages?.map(item=>item.language) || [],message:'Free local neural voice. Previously generated audio is reused.'};}catch{return {ready:false,languages:[],message:'Local neural voice is not installed. Browser voices and captions remain available.'};}},
    async prepare(body){
      if(!['en-US','zh-TW'].includes(body.language) || typeof body.text!=='string' || !body.text.trim() || body.text.length>1800)throw new AppError(400,'Choose English or Mandarin and provide up to 1,800 characters.');
      if(voiceChoices && !voiceChoices.includes(body.voice))throw new AppError(400,'Choose an available voice.');
      if(body.segments!==undefined && (!Array.isArray(body.segments) || body.segments.length<1 || body.segments.length>8 || body.segments.some(value=>typeof value!=='string' || !value.trim()) || body.segments.join(' ')!==body.text.trim()))throw new AppError(400,'Narration segments must match the complete chapter text.');
      const language=body.language,text=body.text.trim(),id=keyFor(language,text,body.voice,body.segments),saved=await metadata(id);
      if(saved){try{await stat(join(audioDirectory,`${id}.wav`));return {...saved,cached:true};}catch{throw new AppError(503,'Saved narration audio is missing.');}}
      if(pending.has(id))return {...await pending.get(id),cached:true};
      if(active)throw new AppError(429,'Another local narration is being prepared. Try again shortly.');
      if(!renderer && !(await this.health()).ready)throw new AppError(503,'Install the free local voice first, or choose Browser voice.');
      // Health may yield to another request; recheck the shared job before claiming it.
      if(pending.has(id))return {...await pending.get(id),cached:true};
      if(active)throw new AppError(429,'Another local narration is being prepared. Try again shortly.');
      active=true;
      const generate=async()=>{
        await mkdir(audioDirectory,{recursive:true});const temporary=join(audioDirectory,`${id}.tmp.wav`);
        try{
          const result=await render({language,text,...(voiceChoices?{voice:body.voice}:{}),...(body.segments?{segments:body.segments}:{}),output:temporary}),file=await readFile(temporary);
          if(file.length<44 || file.length>12000000 || file.toString('ascii',0,4)!=='RIFF' || file.toString('ascii',8,12)!=='WAVE' || !Number.isFinite(result.duration) || result.duration<=0 || result.duration>240)throw new AppError(502,'The local model did not produce valid narration audio.');
          await rename(temporary,join(audioDirectory,`${id}.wav`));
          const cueTimes=body.segments && Array.isArray(result.cueTimes) && result.cueTimes.length===body.segments.length && result.cueTimes.every((time,index)=>Number.isFinite(time) && time>=0 && time<result.duration && (!index || time>result.cueTimes[index-1]))?result.cueTimes:null;
          const report={id,url:`/api/lesson-audio/${id}.wav`,language,voice:result.voice,engine:result.engine,duration:result.duration,...(cueTimes?{cueTimes,cueTiming:result.cueTiming || 'audio-segments'}:{}),modelTokens:0,cached:false};
          const temporaryMetadata=join(audioDirectory,`${id}.${randomUUID()}.tmp`);await writeFile(temporaryMetadata,JSON.stringify(report));await rename(temporaryMetadata,join(audioDirectory,`${id}.json`));return report;
        }finally{await unlink(temporary).catch(()=>{});}
      };
      const request=generate();pending.set(id,request);try{return await request;}finally{pending.delete(id);active=false;}
    },
    async audio(name){if(!/^[a-f0-9]{64}\.wav$/.test(name))throw new AppError(404,'Narration not found.');try{return await readFile(join(audioDirectory,name));}catch{throw new AppError(404,'Narration not found.');}},
  };
}
