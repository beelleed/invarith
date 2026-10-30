import { mkdir,readFile,writeFile,rename,readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from './verification.mjs';

export function createInterviewStore(directory){
  let queue=Promise.resolve();
  const valid=id=>typeof id==='string' && /^[a-f0-9-]{36}$/.test(id);
  const get=async id=>{
    if(!valid(id))throw new AppError(404,'Interview session was not found.');
    try{return JSON.parse(await readFile(join(directory,`${id}.json`),'utf8'));}catch(error){if(error.code==='ENOENT')throw new AppError(404,'Interview session was not found.');throw new AppError(503,'Interview history could not be read. Saved files have been preserved.');}
  };
  return {
    get,
    save(session){
      if(!valid(session.id))throw new AppError(400,'Invalid interview session.');
      const task=async()=>{await mkdir(directory,{recursive:true});const temporary=join(directory,`${session.id}.${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify(session),{encoding:'utf8',mode:0o600});await rename(temporary,join(directory,`${session.id}.json`));};
      const result=queue.then(task);queue=result.catch(()=>{});return result;
    },
    async list(){
      let files;try{files=await readdir(directory);}catch(error){if(error.code==='ENOENT')return [];throw new AppError(503,'Interview history is unavailable.');}
      const sessions=await Promise.all(files.filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)).map(name=>get(name.slice(0,-5))));
      return sessions.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100).map(session=>({id:session.id,mode:session.mode,taskId:session.taskId,title:session.practiceTask?.title||null,sourcePracticeId:session.sourcePracticeId||null,retryOf:session.retryOf||null,status:session.status,deadlineAt:session.deadlineAt||null,minutes:session.minutes||null,updatedAt:session.updatedAt,answers:session.rounds.length,hintsUsed:session.hints.length}));
    },
  };
}
