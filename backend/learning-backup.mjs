import {validSavedPlan} from './practice-plan.mjs';
import {validCustomTests,validCustomBaseline} from './practice-custom-tests.mjs';
import {mkdir,readdir,readFile,writeFile,link,unlink,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './verification.mjs';
import {noteTags} from './practice-notes.mjs';
import {planListRestore} from './practice-lists.mjs';

export const backupLimit=24*1024*1024;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const optional=(value,check)=>value===undefined||check(value);
const totals=value=>object(value)&&integer(value.passed)&&integer(value.total)&&value.total>0&&value.total<=20&&value.passed<=value.total;
const result=value=>totals(value)&&date(value.createdAt)&&['examples','submit'].includes(value.action)&&['examples','hidden_cases'].includes(value.scope)&&optional(value.firstFailure,row=>row===null||object(row)&&integer(row.index)&&['failed','error'].includes(row.status)&&Array.isArray(row.args)&&Object.hasOwn(row,'expected')&&optional(row.error,error=>text(error,12000)))&&optional(value.performance,row=>object(row)&&row.measure==='python_line_events'&&integer(row.total)&&integer(row.baselinePassed)&&integer(row.latestPassed)&&Array.isArray(row.samples)&&row.samples.length<=20&&row.samples.every(sample=>object(sample)&&integer(sample.sample)&&optional(sample.inputSize,n=>n===null||integer(n))&&optional(sample.baselineWork,n=>n===null||integer(n))&&optional(sample.latestWork,n=>n===null||integer(n))&&['passed','failed','error'].includes(sample.status)));
const cases=value=>Array.isArray(value)&&value.length>0&&value.length<=20&&value.every(row=>object(row)&&Array.isArray(row.args)&&Object.hasOwn(row,'expected'));
const snapshot=value=>object(value)&&text(value.code,24000)&&/^[a-f0-9]{64}$/.test(value.fingerprint)&&['examples','submit'].includes(value.action)&&date(value.createdAt)&&integer(value.passed)&&integer(value.total)&&value.total>0&&value.total<=20&&value.passed<=value.total;
function validRecord(record){
  if(!object(record)||!object(record.value))return false;const {bucket,id,value}=record;
  if(bucket==='lists')return id==='index'&&integer(value.revision)&&Array.isArray(value.lists)&&value.lists.length<=20&&new Set(value.lists.map(row=>row?.id)).size===value.lists.length&&value.lists.every(row=>object(row)&&uuid(row.id)&&text(row.name,60)&&row.name.trim()&&date(row.createdAt)&&date(row.updatedAt)&&Array.isArray(row.items)&&row.items.length<=100&&row.items.every(item=>object(item)&&uuid(item.practiceId)&&text(item.title,1000)&&text(item.topic,100)&&date(item.addedAt)));
  if(!uuid(id)||value.id!==id)return false;
  if(bucket==='practice')return text(value.title,1000)&&text(value.contract,12000)&&text(value.code,24000)&&text(value.starterCode,24000)&&typeof value.functionName==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(value.functionName)&&text(value.topic,100)&&['coding','debug','optimize'].includes(value.mode)&&cases(value.examples)&&cases(value.hidden)&&date(value.createdAt)
    &&optional(value.solutionPlan,validSavedPlan)
    &&optional(value.customTests,validCustomTests)
    &&optional(value.customTestBaseline,validCustomBaseline)
    &&optional(value.reports,rows=>object(rows)&&Object.values(rows).every(result))&&optional(value.lastResult,row=>row===null||result(row))
    &&optional(value.assistantHistory,rows=>Array.isArray(rows)&&rows.length<=5&&rows.every(row=>object(row)&&text(row.question,800)&&text(row.answer,20000)))
    &&optional(value.attempts,rows=>Array.isArray(rows)&&rows.length<=10&&rows.every(row=>totals(row)&&uuid(row.id)&&uuid(row.suiteId)&&text(row.code,24000)&&date(row.createdAt)&&Array.isArray(row.statuses)&&row.statuses.length===row.total&&row.statuses.every(status=>['passed','failed','error'].includes(status))))
    &&optional(value.retryOf,row=>row===null||object(row)&&uuid(row.id)&&uuid(row.rootId)&&text(row.title,1000))
    &&optional(value.regressionCases,rows=>Array.isArray(rows)&&rows.length<=10&&rows.every(row=>object(row)&&uuid(row.id)&&Array.isArray(row.args)&&Object.hasOwn(row,'expected')&&/^[a-f0-9]{64}$/.test(row.suiteKey)))
    &&optional(value.regressionLastRun,row=>row===null||totals(row)&&text(row.code,24000)&&integer(row.revision)&&Array.isArray(row.results)&&row.results.every(item=>object(item)&&uuid(item.caseId)&&['passed','failed','error'].includes(item.status)&&optional(item.error,message=>text(message,12000))));
  if(bucket==='notes')return integer(value.revision)&&text(value.title,1000)&&text(value.topic,100)&&text(value.observation,3000)&&text(value.nextTime,3000)&&date(value.updatedAt)&&Array.isArray(value.tags)&&value.tags.length<=6&&value.tags.every(tag=>noteTags.includes(tag));
  if(bucket==='journals')return integer(value.revision)&&Array.isArray(value.items)&&value.items.length<=30&&new Set(value.items.map(item=>item?.id)).size===value.items.length&&value.items.filter(item=>item?.status==='open').length<=1&&value.items.every(item=>object(item)&&uuid(item.id)&&['open','closed'].includes(item.status)&&text(item.hypothesis,1500)&&text(item.experiment,1500)&&text(item.prediction,1500)&&snapshot(item.before)&&(item.after===null||snapshot(item.after)&&item.after.comparable===(item.before.fingerprint===item.after.fingerprint&&item.before.action===item.after.action&&item.before.total===item.after.total))&&date(item.createdAt)&&text(item.conclusion,1500)&&(item.status==='open'||['supports','does_not_support','inconclusive'].includes(item.verdict)));
  return false;
}
export function validateLearningBackup(bundle){
  if(!object(bundle)||bundle.format!=='invarith-practice-backup'||bundle.version!==1||!date(bundle.createdAt)||!Array.isArray(bundle.records)||bundle.records.length>2000)throw new AppError(400,'This is not a supported Invarith practice backup.');
  const stack=[{value:bundle,depth:0}];let nodes=0;
  while(stack.length){const {value,depth}=stack.pop();if(++nodes>600000||depth>40)throw new AppError(400,'This backup is too large or deeply nested.');if(value&&typeof value==='object')for(const child of Object.values(value))stack.push({value:child,depth:depth+1});}
  const seen=new Set();let bytes=0;
  for(const record of bundle.records){if(!validRecord(record))throw new AppError(400,'A record in this backup is invalid. Nothing has been restored.');const key=record.bucket+':'+record.id;if(seen.has(key))throw new AppError(400,'This backup contains duplicate records.');seen.add(key);const length=Buffer.byteLength(JSON.stringify(record));if(length>2*1024*1024)throw new AppError(400,'A backup record exceeds the size limit.');bytes+=length;}
  if(bytes>backupLimit)throw new AppError(413,'Practice backups must be smaller than 24 MB.');return bundle;
}

export function createLearningBackup({practiceDirectory='./data/ai-practice',notesDirectory='./data/practice-notes',journalDirectory='./data/debug-journal',lists,now=()=>Date.now()}={}){
  const directories={practice:practiceDirectory,notes:notesDirectory,journals:journalDirectory},pending=new Map();let restoring=false;
  const file=record=>join(directories[record.bucket],record.id+'.json');
  const clean=()=>{for(const [token,value] of pending)if(value.expires<=now())pending.delete(token);};
  const counts=()=>Object.fromEntries(['practice','notes','journals','lists'].map(key=>[key,{added:0,skipped:0}]));
  async function previewCounts(bundle){
    const result=counts();
    for(const record of bundle.records){if(record.bucket==='lists'){const plan=planListRestore(await lists.list(),record.value.lists);result.lists={added:plan.added,skipped:plan.skipped};continue;}try{await lstat(file(record));result[record.bucket].skipped++;}catch(error){if(error.code!=='ENOENT')throw error;result[record.bucket].added++;}}
    return result;
  }
  return {
    cancel(body){pending.delete(body?.token);return {cancelled:true};},
    async export(){
      const records=[],listIndex=await lists.list();let bytes=Buffer.byteLength(JSON.stringify(listIndex));if(listIndex.lists.length)records.push({bucket:'lists',id:'index',value:listIndex});
      for(const bucket of ['notes','journals','practice']){let files;try{files=await readdir(directories[bucket]);}catch(error){if(error.code==='ENOENT')continue;throw error;}
        for(const name of files.sort()){if(!name.endsWith('.json')||!uuid(name.slice(0,-5)))continue;const path=join(directories[bucket],name),stat=await lstat(path);bytes+=stat.size;if(bytes>backupLimit)throw new AppError(413,'Practice backups must be smaller than 24 MB.');if(!stat.isFile()||stat.size>2*1024*1024)throw new AppError(413,'A saved practice record cannot be included in this backup.');let value;try{value=JSON.parse(await readFile(path,'utf8'));}catch{throw new AppError(503,'A saved record could not be read. No incomplete backup was created.');}records.push({bucket,id:name.slice(0,-5),value});if(records.length>2000)throw new AppError(413,'This backup has too many records.');}
      }
      const bundle=validateLearningBackup({format:'invarith-practice-backup',version:1,createdAt:new Date(now()).toISOString(),records});if(Buffer.byteLength(JSON.stringify(bundle))>backupLimit)throw new AppError(413,'Practice backups must be smaller than 24 MB.');return bundle;
    },
    async preview(bundle){
      validateLearningBackup(bundle);clean();if(pending.size>=2)throw new AppError(429,'Finish a pending restore or wait five minutes before previewing another backup.');
      const token=randomUUID(),expires=now()+5*60000;pending.set(token,{bundle:structuredClone(bundle),expires});try{return {token,expiresAt:new Date(expires).toISOString(),counts:await previewCounts(bundle)};}catch(error){pending.delete(token);throw error;}
    },
    async restore(body){
      clean();const entry=pending.get(body?.token);if(!entry)throw new AppError(409,'This restore preview expired. Choose the backup again.');if(restoring)throw new AppError(429,'A practice restore is already running.');restoring=true;
      const result=counts();let partial=false,message=null;
      try{
        // Questions go first, so newly restored notes and lists can open them.
        const records=entry.bundle.records.filter(row=>row.bucket!=='lists').sort((a,b)=>(a.bucket==='practice'?0:1)-(b.bucket==='practice'?0:1));
        for(const record of records){const directory=directories[record.bucket],temporary=join(directory,'.restore-'+randomUUID()+'.tmp');await mkdir(directory,{recursive:true});
          try{await writeFile(temporary,JSON.stringify(record.value),{mode:0o600,flag:'wx'});await link(temporary,file(record));result[record.bucket].added++;}catch(error){if(error.code==='EEXIST')result[record.bucket].skipped++;else throw error;}finally{await unlink(temporary).catch(()=>{});}
        }
        const index=entry.bundle.records.find(row=>row.bucket==='lists');if(index)result.lists=await lists.restoreMissing(index.value.lists);
        pending.delete(body.token);
      }catch(error){partial=true;message=error instanceof AppError?error.message:'Some backup data could not be written. Check disk space and folder access, then retry.';}finally{restoring=false;}
      return {status:partial?'partial':'completed',counts:result,canRetry:partial,...(message?{message}:{})};
    }
  };
}
