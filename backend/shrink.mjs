import { AppError } from './verification.mjs';

import { shrinkContracts, shrinkableCase } from '../frontend/shrink-contracts.mjs';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const observation=row=>row.status==='error' ? `${row.status}:${row.error}` : `${row.status}:${JSON.stringify(row.actual)}`;
const exception=row=>String(row.error || '').split(':')[0];
const compact=row=>({status:row.status,...(row.status==='error'?{error:row.error}:{actual:row.actual})});
function candidates(values){
  const half=Math.ceil(values.length/2), output=[[],values.slice(0,half),values.slice(half)];
  for(let i=0;i<values.length;i++)output.push(values.filter((_,index)=>index!==i));
  return [...new Map(output.filter(item=>item.length<values.length).map(item=>[JSON.stringify(item),item])).values()];
}

// An explicit, user-selected contract supplies every changed input's expectation.
// Neither a model nor the original case's constant expected value acts as an oracle.
export async function shrinkCounterexample(record,body,run){
  const contract=shrinkContracts[body.contract];
  if(!Object.hasOwn(shrinkContracts,body.contract) || body.confirmContract!==true)throw new AppError(400,'Select and explicitly confirm a supported contract before shrinking.');
  const index=body.caseIndex, original=record.submission.cases[index], observed=record.evidence.results[index];
  if(!Number.isInteger(index) || index<0 || !original || !observed || !['failed','error'].includes(observed.status))throw new AppError(409,'Select a completed failing case. Passing cases cannot be shrunk.');
  const values=original.args?.[0];
  if(!shrinkableCase(original))throw new AppError(400,'Shrinking currently supports one list argument, at most 32 integers between -1,000,000 and 1,000,000, with no keyword arguments.');
  if(!equal(contract.expected(values),original.expected))throw new AppError(409,'The selected contract disagrees with the original expected value. Review the intended behavior; the saved test will not be changed.');
  const started=Date.now(), attempts=[];
  const execute=async lists=>{
    const cases=lists.map(list=>({args:[list],expected:contract.expected(list)}));
    const evidence=await run({...record.submission,cases});
    if(evidence.results?.length!==cases.length || evidence.results.some((row,i)=>row.index!==i || !['passed','failed','error'].includes(row.status)))throw new AppError(502,'Incomplete shrink execution response. No reduced case can be established.');
    evidence.results.forEach((row,i)=>attempts.push({input:lists[i],expected:cases[i].expected,...compact(row)}));
    return evidence.results;
  };
  const [replayed]=await execute([values]);
  const report={sourceRunId:record.evidence.id,caseIndex:index,contract:body.contract,contractText:contract.label,confirmedAt:new Date().toISOString(),execution:'docker-python',original:{input:values,expected:original.expected,...compact(observed)},attempts,limits:{searchCases:8,totalCases:10,searchRounds:4,searchTimeMs:45000},minimality:'Bounded deletion search only; no global or one-element minimality guarantee.'};
  if(observation(replayed)!==observation(observed))return {...report,status:'unstable',message:'The original observation did not reproduce. No reduced counterexample is established.'};
  const preserves=row=>observed.status==='failed'?row.status==='failed':row.status==='error' && exception(row)===exception(observed);
  let best=values,bestRow=replayed,searchCases=0;
  const seen=new Set([JSON.stringify(values)]);
  for(let round=0;round<4 && searchCases<8 && best.length && Date.now()-started<45000;round++){
    const proposed=candidates(best).filter(list=>!seen.has(JSON.stringify(list))).slice(0,Math.min(2,8-searchCases));
    if(!proposed.length)break;
    proposed.forEach(list=>seen.add(JSON.stringify(list)));searchCases+=proposed.length;
    const results=await execute(proposed);
    for(let i=0;i<results.length;i++)if(preserves(results[i]) && proposed[i].length<best.length){best=proposed[i];bestRow=results[i];}
  }
  if(best.length===values.length)return {...report,status:'not_reduced',message:'No shorter failure was observed within the search budget. This does not establish minimality.'};
  if(Date.now()-started>=45000)return {...report,status:'incomplete',message:'Search time limit reached before final replay. No reduced counterexample is established.'};
  const [final]=await execute([best]);
  if(!preserves(final) || observation(final)!==observation(bestRow))return {...report,status:'unstable',message:'The reduced observation did not reproduce on final replay. No reduced counterexample is established.'};
  return {...report,status:'reduced',reduced:{input:best,expected:contract.expected(best),...compact(final)},message:`Observed a shorter failing input: ${values.length} → ${best.length} items. Original tests are unchanged.`};
}
