import {translate} from './i18n.mjs';
const json=value=>JSON.stringify(value,(_key,item)=>{if(item===undefined||['function','symbol','bigint'].includes(typeof item)||typeof item==='number'&&!Number.isFinite(item))throw Error('Public lesson examples must contain valid JSON values.');return item;});
export function practiceLessonInput(detail,language='en-US',limit=4000){
  if(!detail||typeof detail.contract!=='string'||!detail.contract.trim()||typeof detail.functionName!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(detail.functionName)||!Array.isArray(detail.examples))throw Error('Choose a complete question with a function contract before opening a lesson.');
  const t=(source,...values)=>translate(source,values,language==='zh-TW'?'zh-TW':'en');
  const contract=detail.contract.trim(),title=typeof detail.title==='string'?detail.title.trim().slice(0,80):'',scenario=typeof detail.scenario==='string'?detail.scenario.trim():'';
  let problem=[title,t('Function: {0}',detail.functionName),contract].filter(Boolean).join('\n\n');
  if(problem.length>limit)throw Error('The full question is too long for a lesson. Shorten the description without removing its requirements, then try again.');
  const examples=[];
  for(const item of detail.examples){
    if(!item||!Array.isArray(item.args)||!Object.hasOwn(item,'expected')||item.kwargs!==undefined&&(!item.kwargs||typeof item.kwargs!=='object'||Array.isArray(item.kwargs)))throw Error('Public lesson examples must contain valid JSON values.');
    const call=detail.functionName+'('+[...item.args.map(json),...Object.entries(item.kwargs||{}).map(([key,value])=>key+'='+json(value))].join(', ')+') → '+json(item.expected);
    const next=problem+'\n\n'+t('Public examples')+':\n'+[...examples,call].join('\n');
    if(next.length<=limit)examples.push(call);
  }
  if(examples.length)problem+='\n\n'+t('Public examples')+':\n'+examples.join('\n');
  const includeScenario=Boolean(scenario&&scenario!==contract&&problem.length+scenario.length+2<=limit);
  if(includeScenario)problem+='\n\n'+scenario;
  return {problem,omittedExamples:detail.examples.length-examples.length,omittedScenario:Boolean(scenario&&scenario!==contract&&!includeScenario)};
}
