import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {practiceTasks} from './practice-contracts.mjs';
import {AppError} from './verification.mjs';

const profiles={binary:{kind:'array',arity:2,max:400,range:1000,sorted:true},pointers:{kind:'array',arity:2,max:400,range:1000,distinct:true,sorted:true},prefix:{kind:'array',arity:2,max:40,range:10,target:20},hash:{kind:'array',arity:1,max:80,range:100},monotonic:{kind:'array',arity:1,max:80,range:10},strings:{kind:'text',arity:1,max:80,alphabet:/^[a-z]*$/},sliding:{kind:'text',arity:1,max:80,alphabet:/^[a-z]*$/},stack:{kind:'text',arity:1,max:80,alphabet:/^[()[\]{}]*$/}};
export function practiceShrinkProfile(session){
  const id=session.taskId||session.topic;if(typeof id!=='string'||!Object.hasOwn(practiceTasks,id))return null;
  const parts=id.split(':'),task=practiceTasks[id],profile=Object.hasOwn(profiles,parts[0])?profiles[parts[0]]:null;
  return session.kind!=='generated'&&profile&&task&&parts.length<=2&&(!parts[1]||parts[1]==='extended')&&session.functionName===task.name&&[task.en,task.zh].includes(session.contract)?{...profile,task}:null;
}
const compact=row=>({status:row.status,...(row.status==='error'?{error:row.error}:{actual:row.actual})});
const sameObservation=(a,b)=>a.status===b.status&&(a.status==='error'?a.error===b.error:isDeepStrictEqual(a.actual,b.actual));
const errorType=row=>String(row.error||'').split(':')[0];
export async function shrinkPracticeFailure(session,source,code,run,now=()=>Date.now()){
  const profile=practiceShrinkProfile(session),args=source.item.args,value=args?.[0];
  if(!profile)throw new AppError(400,'Smaller counterexamples are available only for supported curated questions.');
  const valid=args.length===profile.arity&&!Object.keys(source.item.kwargs||{}).length&&value?.length<=profile.max&&(profile.kind==='text'?typeof value==='string'&&profile.alphabet.test(value):Array.isArray(value)&&value.every(n=>Number.isInteger(n)&&Math.abs(n)<=profile.range)&&(!profile.sorted||value.every((n,i)=>i===0||value[i-1]<=n))&&(!profile.distinct||new Set(value).size===value.length))&&(profile.arity===1||Number.isSafeInteger(args[1])&&(profile.target===undefined||Math.abs(args[1])<=profile.target));
  if(!valid)throw new AppError(400,'This failing input is outside the supported reduction limits.');
  if(!isDeepStrictEqual(profile.task.oracle(args),source.item.expected))throw new AppError(409,'The saved expectation disagrees with the curated rule. No reduction was run.');
  const started=now(),observed=source.failure,attempts=[];
  const report={id:randomUUID(),createdAt:new Date(started).toISOString(),status:'not_reduced',original:{args:structuredClone(args),expected:source.item.expected,...compact(observed)},attempts,limits:{searchCases:8,totalCases:10,rounds:4,timeMs:45000}};
  const execute=async values=>{const cases=values.map(first=>{const next=[first,...args.slice(1)];return {args:next,expected:profile.task.oracle(next)};});
    const evidence=await run({code,functionName:session.functionName,cases:cases.map(c=>({args:structuredClone(c.args),expected:null}))});
    if(evidence.results?.length!==cases.length||evidence.results.some((r,i)=>r.index!==i||!['passed','failed','error'].includes(r.status)||r.status!=='error'&&!Object.hasOwn(r,'actual')))throw new AppError(502,'Incomplete reduction execution. No smaller failure was established.');
    return evidence.results.map((row,i)=>{const result={...compact(row),status:row.status==='error'?'error':isDeepStrictEqual(row.actual,cases[i].expected)?'passed':'failed'};attempts.push({...cases[i],...result});return result;});
  };
  const [replayed]=await execute([value]);if(!sameObservation(replayed,observed))return {...report,status:'unstable'};
  const preserves=row=>observed.status==='failed'?row.status==='failed':row.status==='error'&&errorType(row)===errorType(observed);
  let best=value,bestRow=replayed,searched=0;const seen=new Set([JSON.stringify(value)]);
  for(let round=0;round<4&&searched<8&&best.length&&now()-started<45000;round++){
    const half=Math.ceil(best.length/2),empty=profile.kind==='text'?'':[],choices=[empty,best.slice(0,half),best.slice(half)];
    for(let i=0;i<best.length;i++)choices.push(profile.kind==='text'?best.slice(0,i)+best.slice(i+1):best.filter((_,j)=>j!==i));
    const candidates=[];for(const next of choices){const key=JSON.stringify(next);if(next.length<best.length&&!seen.has(key)){seen.add(key);candidates.push(next);}if(candidates.length===Math.min(2,8-searched))break;}
    if(!candidates.length)break;searched+=candidates.length;const results=await execute(candidates);
    for(let i=0;i<results.length;i++)if(preserves(results[i])&&candidates[i].length<best.length){best=candidates[i];bestRow=results[i];}
  }
  if(best.length===value.length)return report;
  if(now()-started>=45000)return {...report,status:'incomplete'};
  const [final]=await execute([best]);if(!preserves(final)||!sameObservation(final,bestRow))return {...report,status:'unstable'};
  return {...report,status:'reduced',reduced:{args:[best,...args.slice(1)],expected:profile.task.oracle([best,...args.slice(1)]),...compact(final)}};
}
