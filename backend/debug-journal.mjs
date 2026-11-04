import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './verification.mjs';

export function createDebugJournal({practice,directory='./data/debug-journal',now=()=>Date.now()}={}){
  const locks=new Set();
  const path=id=>{if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new AppError(404,'Debug journal was not found.');return join(directory,id+'.json');};
  const read=async id=>{try{return JSON.parse(await readFile(path(id),'utf8'));}catch(error){if(error.code==='ENOENT')return {id,revision:0,items:[]};throw error;}};
  const text=value=>typeof value==='string'&&value.trim()&&value.length<=1500;
  return {
    async get(id){path(id);await practice.open(id);return read(id);},
    async update(body){
      path(body.id);
      if(!['start','attach','conclude'].includes(body.operation)||!Number.isInteger(body.revision)||body.revision<0)throw new AppError(400,'Choose a debug journal action and revision.');
      if(locks.has(body.id))throw new AppError(409,'This debug journal is being updated.');locks.add(body.id);
      try{
        const journal=await read(body.id);if(journal.revision!==body.revision)throw new AppError(409,'This debug journal changed elsewhere. Reload before saving.');
        const timestamp=new Date(now()).toISOString();
        if(body.operation==='start'){
          if(![body.hypothesis,body.experiment,body.prediction].every(text))throw new AppError(400,'Describe a hypothesis, experiment and prediction in up to 1,500 characters each.');
          if(journal.items.some(row=>row.status==='open'))throw new AppError(409,'Conclude the open hypothesis before starting another.');
          if(journal.items.length>=30)throw new AppError(400,'This question already has 30 saved hypotheses.');
          const before=await practice.debugEvidence(body);
          if(before.passed===before.total)throw new AppError(409,'Start with a saved failing test result.');
          journal.items.push({id:randomUUID(),status:'open',hypothesis:body.hypothesis.trim(),experiment:body.experiment.trim(),prediction:body.prediction.trim(),before,after:null,createdAt:timestamp,verdict:null,conclusion:''});
        }else{
          const item=journal.items.find(row=>row.id===body.hypothesisId);if(!item||item.status!=='open')throw new AppError(409,'This hypothesis is no longer open.');
          if(body.operation==='attach'){
            const observed=await practice.debugEvidence(body);
            if(Date.parse(observed.createdAt)<=Math.max(Date.parse(item.before.createdAt),Date.parse(item.createdAt)))throw new AppError(409,'Run a new experiment before attaching its result.');
            item.after={...observed,comparable:observed.fingerprint===item.before.fingerprint&&observed.action===item.before.action&&observed.total===item.before.total};
          }else{
            if(!['supports','does_not_support','inconclusive'].includes(body.verdict)||!text(body.conclusion))throw new AppError(400,'Choose your conclusion and explain it in up to 1,500 characters.');
            if(body.verdict!=='inconclusive'&&!item.after?.comparable)throw new AppError(409,'Without comparable test evidence, keep the conclusion inconclusive.');
            item.verdict=body.verdict;item.conclusion=body.conclusion.trim();item.status='closed';item.closedAt=timestamp;
          }
        }
        journal.revision++;journal.updatedAt=timestamp;await mkdir(directory,{recursive:true});const tmp=path(body.id)+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(journal),{mode:0o600});await rename(tmp,path(body.id));return journal;
      }finally{locks.delete(body.id);}
    }
  };
}
