import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createLocalVoice } from './local-voice.mjs';
import { AppError,command } from './verification.mjs';
import { buildExampleLesson,frameNarration } from '../frontend/lesson-examples.mjs';
import { narrationSegments } from '../frontend/teacher-storyboards.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const taiwanVoices=['zh-TW-HsiaoChenNeural','zh-TW-HsiaoYuNeural'];
export function createTaiwanVoice(lessons,{directory=join(root,'data/taiwan-voice'),renderer,generatedLessons}={}){
  const render=renderer || (async request=>{const response=await command(join(root,'.venv-tts',process.platform==='win32'?'Scripts/python.exe':'bin/python'),[join(root,'backend/taiwan-voice.py')],{input:JSON.stringify(request),timeout:55000,maxOutput:8000,unavailableMessage:'Taiwan voice dependencies are not installed.',timeoutMessage:'The online voice service timed out. No completed audio was saved.'});if(response.code!==0)throw new AppError(503,'Taiwan voice service is unavailable. Use Kokoro or Browser voice.');try{return JSON.parse(response.stdout);}catch{throw new AppError(502,'Taiwan voice did not return valid audio metadata.');}});
  const cache=createLocalVoice({directory,renderer:render,namespace:'taiwan-teacher-lessons-v2',voiceChoices:taiwanVoices});
  return {
    close:()=>cache.close(),
    async prepare(body){
      if(!taiwanVoices.includes(body.voice) || !Number.isInteger(body.chapterIndex))throw new AppError(400,'Choose a Taiwan voice and a worked-lesson chapter.');
      // No arbitrary text/code from the request can be transmitted to Microsoft.
      let deck;
      if(body.lessonId){
        if(body.allowOnline!==true||!generatedLessons)throw new AppError(400,'Confirm sending generated lesson narration to the online voice service.');
        const lesson=await generatedLessons.get(body.lessonId);
        if(lesson.language!=='zh-TW')throw new AppError(400,'Choose a Chinese lesson for Taiwan narration.');
        deck={frames:lesson.frames,lessonVersion:'solution-v1',context:{summary:{}}};
      }else deck=buildExampleLesson(await lessons.get(body.exampleId));
      if(body.chapterIndex<0 || body.chapterIndex>=deck.frames.length)throw new AppError(400,'Choose an existing worked-lesson chapter.');
      if(body.lessonVersion!==deck.lessonVersion)throw new AppError(409,'The teaching lesson changed. Reload the page before playing it.');
      const result=await cache.prepare({language:'zh-TW',voice:body.voice,text:frameNarration(deck,body.chapterIndex,'zh-TW'),segments:narrationSegments(deck,body.chapterIndex,'zh-TW')});
      return {...result,url:result.url.replace('/api/lesson-audio/','/api/taiwan-lesson-audio/'),scope:body.lessonId?'Generated narration sent with explicit consent.':'Public worked-lesson narration only. No learner code is sent.'};
    },
    audio:name=>cache.audio(name),
    async preview(name){const file={'hsiaochen.mp3':'hsiaochen-preview.mp3','hsiaoyu.mp3':'hsiaoyu-preview.mp3'}[name];if(!file)throw new AppError(404,'Voice sample not found.');try{return await readFile(join(directory,file));}catch{throw new AppError(404,'This saved voice sample is not installed.');}},
  };
}
