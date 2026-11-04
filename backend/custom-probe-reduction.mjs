import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {AppError,validateSubmission} from './verification.mjs';
import {validateCustomCases} from './practice-custom-tests.mjs';
import {customVariantSource} from './practice-test-strength.mjs';
import {reducibleProbeValue,probeValueLength,probeReductionChoices} from '../frontend/probe-reduction.mjs';
export async function reduceCustomProbe(session,body,report,probe,run,now=()=>Date.now()){
  const variant=customVariantSource(session,body,report);
  if(!probe||probe.id!==body.probeId||probe.checkId!==report.checkId||probe.sourceRunId!==body.runId||probe.variantId!==variant.id||probe.status!=='distinguished')throw new AppError(409,'Compare a distinguishing input again before reducing it.');
  const source=probe.case,value=source.args[0];
  if(!reducibleProbeValue(value))throw new AppError(400,'Reduction supports a first positional argument that is a short string or flat array.');
  const started=now(),attempts=[],result={id:randomUUID(),createdAt:new Date(started).toISOString(),status:'not_reduced',original:probe,attempts,limits:{candidateInputs:4,rounds:2,timeMs:45000},scope:'differential_observation',requiresContractReview:true};
  const execute=async values=>{
    const cases=values.map(first=>({args:[structuredClone(first),...structuredClone(source.args.slice(1))],kwargs:structuredClone(source.kwargs),expected:null}));
    const observe=async code=>{
      const evidence=await run(validateSubmission({code,functionName:session.functionName,cases:structuredClone(cases)}));
      if(evidence.results?.length!==cases.length||evidence.results.some((row,i)=>row.index!==i||!['passed','failed','error'].includes(row.status)||row.status!=='error'&&!Object.hasOwn(row,'actual')))throw new AppError(502,'Incomplete reduced-input execution.');
      return evidence.results.map(row=>row.status==='error'?{status:'error',error:row.error}:{status:'returned',actual:row.actual});
    };
    const original=await observe(session.customTests.lastRun.code),changed=await observe(variant.code);
    return values.map((first,i)=>({args:cases[i].args,kwargs:cases[i].kwargs,original:original[i],changed:changed[i],different:original[i].status==='returned'&&changed[i].status==='returned'&&!isDeepStrictEqual(original[i].actual,changed[i].actual)}));
  };
  const [replayed]=await execute([value]);if(!replayed.different||!isDeepStrictEqual(replayed.original.actual,probe.original.actual)||!isDeepStrictEqual(replayed.changed.actual,probe.changed.actual))return {...result,status:'unstable'};
  let best=value,bestRow=replayed,searched=0;const seen=new Set([JSON.stringify(value)]);
  for(let round=0;round<2&&searched<4&&probeValueLength(best)>0&&now()-started<45000;round++){
    const choices=probeReductionChoices(best).filter(next=>!seen.has(JSON.stringify(next))).slice(0,Math.min(2,4-searched));if(!choices.length)break;
    choices.forEach(next=>seen.add(JSON.stringify(next)));searched+=choices.length;const rows=await execute(choices);attempts.push(...rows);
    for(let i=0;i<rows.length;i++)if(rows[i].different&&probeValueLength(choices[i])<probeValueLength(best)){best=choices[i];bestRow=rows[i];}
  }
  if(probeValueLength(best)===probeValueLength(value))return result;
  if(now()-started>=45000)return {...result,status:'incomplete'};
  const [final]=await execute([best]);if(!final.different||!isDeepStrictEqual(final.original,bestRow.original)||!isDeepStrictEqual(final.changed,bestRow.changed))return {...result,status:'unstable'};
  let candidate;try{candidate=validateCustomCases([{id:randomUUID(),label:source.label,args:final.args,kwargs:final.kwargs,expected:final.original.actual}])[0];}catch{return {...result,status:'incomplete'};}
  return {...result,status:'reduced',reduced:{...final,case:candidate,expectationSource:'original_execution_proposal',beforeLength:probeValueLength(value),afterLength:probeValueLength(best)}};
}
