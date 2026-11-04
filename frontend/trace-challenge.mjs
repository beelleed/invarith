// Only complete integer / boolean / None previews can be compared reliably.
// Containers, strings, floats and abbreviated previews remain for inspection.
function scalar(value){
  if(typeof value!=='string')return null;
  if(/^-?(?:0|[1-9]\d*)$/.test(value))return {kind:'integer',value:BigInt(value)};
  if(['True','False','None'].includes(value))return {kind:'literal',value};
  return null;
}
export function traceQuestions(replay,limit=5){
  const events=replay?.events||[],lines=String(replay?.code||'').split('\n'),questions=[];
  if(!Number.isInteger(limit)||limit<1)return [];
  for(let index=0;index<events.length-1&&questions.length<Math.min(limit,10);index++){
    const before=events[index],after=events[index+1];
    if(before?.event!=='line'||after?.event!=='line'||before.function!==after.function||before.file!==after.file||!Number.isInteger(before.line)||before.line<1||before.line>lines.length||!Number.isInteger(after.line)||after.line<1||after.line>lines.length)continue;
    for(const [name,expected] of Object.entries(after.variables||{})){
      const prior=before.variables?.[name];
      if(!Object.hasOwn(before.variables||{},name)||!scalar(prior)||!scalar(expected)||prior===expected)continue;
      questions.push({id:`${index}:${name}`,eventIndex:index,variable:name,before:prior,expected,line:before.line,nextLine:after.line,function:before.function,variables:before.variables,source:lines[before.line-1]});
      break;
    }
  }
  return questions;
}
export function compareTracePrediction(answer,expected){
  const target=scalar(expected);if(!target||typeof answer!=='string'||answer.trim().length>160)return null;
  const value=answer.trim();
  if(target.kind==='literal')return value===target.value;
  if(!/^[+-]?\d+$/.test(value))return false;
  return BigInt(value)===target.value;
}
