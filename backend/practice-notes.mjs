import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './verification.mjs';

export const noteTags=['boundaries','requirements','invariant','data_structure','complexity','implementation'];
export function createPracticeNotes({directory='./data/practice-notes',practice,now=()=>Date.now()}={}){
  const locks=new Set();
  const file=id=>{if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new AppError(404,'Practice note not found.');return join(directory,id+'.json');};
  const read=async id=>{try{return JSON.parse(await readFile(file(id),'utf8'));}catch(e){if(e.code==='ENOENT')return {id,revision:0,observation:'',nextTime:'',tags:[],updatedAt:null};throw e;}};
  return {
    async get(id){await practice.open(id);return read(id);},
    async list(){let files;try{files=await readdir(directory);}catch(e){if(e.code==='ENOENT')return [];throw e;}
      const notes=await Promise.all(files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).map(f=>read(f.slice(0,-5))));
      return notes.filter(n=>n.observation.trim()||n.nextTime.trim()||n.tags.length).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100);
    },
    async save(body){
      file(body.id);
      if(!Number.isInteger(body.revision)||body.revision<0||typeof body.observation!=='string'||body.observation.length>3000||typeof body.nextTime!=='string'||body.nextTime.length>3000||!Array.isArray(body.tags)||body.tags.length>noteTags.length||new Set(body.tags).size!==body.tags.length||body.tags.some(t=>!noteTags.includes(t)))throw new AppError(400,'Provide a note of up to 3,000 characters per field and supported tags.');
      if(locks.has(body.id))throw new AppError(429,'This note is being saved. Please retry.');locks.add(body.id);
      try{const task=await practice.open(body.id),previous=await read(body.id);if(previous.revision!==body.revision)throw new AppError(409,'This note changed elsewhere. Review the saved version before replacing it.');
        const note={id:body.id,revision:previous.revision+1,title:task.title,topic:task.topic,observation:body.observation,nextTime:body.nextTime,tags:[...body.tags],updatedAt:new Date(now()).toISOString()};
        await mkdir(directory,{recursive:true});const temp=join(directory,body.id+'.'+randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(note),{mode:0o600});await rename(temp,file(body.id));return note;
      }finally{locks.delete(body.id);}
    }
  };
}
