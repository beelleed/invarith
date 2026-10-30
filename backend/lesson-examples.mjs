import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from './verification.mjs';
import { lessonExamples } from '../frontend/lesson-examples.mjs';

export function createExampleLessons(directory,run){
  const pending=new Map();
  const keyFor=example=>createHash('sha256').update(JSON.stringify(['explained-example-v1',example])).digest('hex');
  const cached=async example=>{try{return JSON.parse(await readFile(join(directory,`${keyFor(example)}.json`),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw new AppError(503,'Saved example evidence could not be read.');}};
  return {
    async get(exampleId){const example=lessonExamples.find(item=>item.id===exampleId);if(!example)throw new AppError(400,'Choose an existing worked lesson.');const report=await cached(example);if(!report)throw new AppError(400,'Open the worked lesson before requesting its narration.');return report;},
    async list(){return Promise.all(lessonExamples.map(async example=>({id:example.id,title:example.title,description:example.description,ready:Boolean(await cached(example))})));},
    async prepare(body){
      const example=lessonExamples.find(item=>item.id===body.exampleId);if(!example)throw new AppError(400,'Choose an existing worked lesson.');
      const saved=await cached(example);if(saved)return {...saved,cached:true};
      if(pending.has(example.id))return {...await pending.get(example.id),cached:true};
      const generate=async()=>{
        const execute=async code=>{const submission={functionName:example.functionName,intent:example.intent,code,cases:structuredClone(example.cases)},snapshot=JSON.stringify(submission),evidence=await run(submission);if(JSON.stringify(submission)!==snapshot || evidence.results?.length!==submission.cases.length || evidence.results.some((row,index)=>row.index!==index || !['passed','failed','error'].includes(row.status)))throw new AppError(502,'Worked example returned incomplete evidence.');return {submission,evidence:{...evidence,id:evidence.id || randomUUID()}};};
        const before=await execute(example.code),after=await execute(example.repair);
        if(before.evidence.results[example.caseIndex].status==='passed' || after.evidence.results.some(row=>row.status!=='passed'))throw new AppError(502,'The worked example did not reproduce the expected before/after observations. No verified lesson was created.');
        const report={exampleId:example.id,createdAt:new Date().toISOString(),source:'curated_explanation_with_observed_execution',before,after};
        await mkdir(directory,{recursive:true});const path=join(directory,`${keyFor(example)}.json`),temporary=`${path}.${randomUUID()}.tmp`;await writeFile(temporary,JSON.stringify(report));await rename(temporary,path);return report;
      };
      const request=generate();pending.set(example.id,request);try{return {...await request,cached:false};}finally{pending.delete(example.id);}
    },
  };
}
