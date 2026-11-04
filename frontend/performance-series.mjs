const count=value=>Number.isSafeInteger(value)&&value>=0;
export function performanceSeries(performance){
  if(performance?.measure!=='python_line_events'||!Array.isArray(performance.samples))return {points:[],excluded:performance?.samples?.length||0,normalizable:false,growth:null};
  const allPassed=key=>Number.isInteger(performance.total)&&performance.total>0&&performance[key]===performance.total;
  const points=performance.samples.map((row,index)=>row&&typeof row==='object'?({...row,sample:Number.isInteger(row.sample)?row.sample:index+1,baselinePassed:row.baselineStatus!==undefined?row.baselineStatus==='passed':allPassed('baselinePassed'),latestPassed:row.status!==undefined?row.status==='passed':allPassed('latestPassed')}):null).filter(row=>row&&row.baselinePassed&&row.latestPassed&&count(row.inputSize)&&count(row.baselineWork)&&count(row.latestWork)).sort((a,b)=>a.inputSize-b.inputSize||a.sample-b.sample);
  const first=points[0],last=points.at(-1),normalizable=Boolean(first&&last.inputSize>first.inputSize&&first.baselineWork>0&&first.latestWork>0);
  const growth=normalizable&&points.length>1&&first.inputSize>0&&last.inputSize>first.inputSize?{input:last.inputSize/first.inputSize,baseline:last.baselineWork/first.baselineWork,latest:last.latestWork/first.latestWork}:null;
  return {points,excluded:performance.samples.length-points.length,normalizable,growth};
}
export function lineEventRatio(row){return row&&count(row.baselineWork)&&count(row.latestWork)&&row.latestWork>0?row.baselineWork/row.latestWork:null;}
