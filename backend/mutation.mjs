import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AppError,command,runnerHealth } from './verification.mjs';

const pairs=new Map([['>=','>'],['>','>='],['<=','<'],['<','<='],['==','!='],['!=','==']]);
export function validateMutations(scan,source){
  if(!Array.isArray(scan?.mutants) || scan.mutants.length>3)throw new AppError(502,'Invalid mutation scan. No variants were executed.');
  const bytes=Buffer.from(source,'utf8'),seen=new Set();
  return scan.mutants.map((item,index)=>{
    if(!Number.isInteger(item.offset) || item.offset<0 || !Number.isInteger(item.line) || item.line<1 || !pairs.has(item.before) || pairs.get(item.before)!==item.after || seen.has(item.offset) || bytes.subarray(item.offset,item.offset+item.before.length).toString('utf8')!==item.before || bytes.subarray(0,item.offset).toString('utf8').split('\n').length!==item.line)throw new AppError(502,'Invalid comparison location. No variants were executed.');
    seen.add(item.offset);
    const code=Buffer.concat([bytes.subarray(0,item.offset),Buffer.from(item.after),bytes.subarray(item.offset+item.before.length)]).toString('utf8');
    return {id:`m${index+1}`,line:item.line,offset:item.offset,before:item.before,after:item.after,code};
  });
}

export async function scanMutations(submission){
  const health=await runnerHealth();if(!health.ready)throw new AppError(503,health.message);
  const script=await readFile(new URL('./mutation_scan.py',import.meta.url),'utf8'),name=`invarith-mutations-${randomUUID()}`;
  try{
    const result=await command('docker',['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--memory=128m','--memory-swap=128m','--cpus=0.5','--pids-limit=32','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--log-driver=none','-i',process.env.PYTHON_IMAGE || 'python:3.12-alpine','python','-I','-B','-c',script],{input:JSON.stringify({code:submission.code,functionName:submission.functionName}),timeout:6000});
    if(result.code!==0)throw new AppError(503,'Mutation scan did not complete. No variants were executed.');
    let scan;try{scan=JSON.parse(result.stdout);}catch{throw new AppError(502,'Unreadable mutation scan. No variants were executed.');}
    return {mutants:validateMutations(scan,submission.code),note:typeof scan.note==='string'?scan.note.slice(0,600):''};
  }finally{await command('docker',['rm','-f',name],{timeout:5000}).catch(()=>{});}
}

const rowsFor=(submission,evidence)=>{
  if(evidence.results?.length!==submission.cases.length || evidence.results.some((row,index)=>row.index!==index || !['passed','failed','error'].includes(row.status)))throw new AppError(502,'Incomplete mutation execution evidence.');
  return evidence.results.map(row=>({index:row.index,status:row.status,expected:submission.cases[row.index].expected,...(row.status==='error'?{error:row.error}:{actual:row.actual})}));
};

export async function checkMutations(record,run,scan=scanMutations){
  const {submission,evidence}=record;
  if(!evidence.results?.length || evidence.passed!==evidence.total || evidence.results.some(row=>row.status!=='passed'))throw new AppError(409,'Complete a passing run before checking your tests.');
  const started=Date.now(),report={sourceRunId:evidence.id,createdAt:new Date().toISOString(),execution:'docker-python',status:'completed',limits:{mutants:3,replayRuns:1,searchTimeMs:45000},variants:[],limitations:'Only up to three supported comparison changes are sampled. Surviving variants may indicate missing tests, unreachable code, or equivalent behavior. Errors and timeouts are separate from detected return-value changes. This is not a completeness or correctness score.'};
  const baseline=await run(structuredClone(submission));report.baseline={createdAt:baseline.createdAt,results:rowsFor(submission,baseline)};
  if(report.baseline.results.some(row=>row.status!=='passed'))return {...report,status:'baseline_changed',note:'The saved passing suite did not pass on replay. Resolve this observation before interpreting mutations.'};
  const found=await scan(submission);
  // Reconstruct exact byte edits, rather than trusting code from a scanner adapter.
  const variants=validateMutations(found,submission.code);
  report.note=found.note;
  for(const variant of variants){
    const entry={...variant};report.variants.push(entry);
    if(Date.now()-started>=45000){entry.status='not_run';entry.reason='Search time budget reached before this variant.';continue;}
    try{
      const observed=await run({...structuredClone(submission),code:variant.code});entry.results=rowsFor(submission,observed);
      entry.status=entry.results.some(row=>row.status==='failed')?'detected':entry.results.some(row=>row.status==='error')?'execution_error':'survived';
    }catch(error){entry.status='inconclusive';entry.reason=error.status?error.message:'Variant execution did not complete. No detection conclusion is available.';}
  }
  if(!report.variants.length)report.status='no_supported_mutations';
  return report;
}
