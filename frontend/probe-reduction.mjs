export function reducibleProbeValue(value){return typeof value==='string'?Array.from(value).length<=80:Array.isArray(value)&&value.length<=80&&value.every(v=>v===null||['string','number','boolean'].includes(typeof v));}
export const probeValueLength=value=>typeof value==='string'?Array.from(value).length:value.length;
export function probeReductionChoices(value){
  const list=typeof value==='string'?Array.from(value):value,join=items=>typeof value==='string'?items.join(''):items,half=Math.ceil(list.length/2);
  const choices=[[],list.slice(0,half),list.slice(half)];for(let i=0;i<list.length;i++)choices.push(list.filter((_,j)=>j!==i));
  const seen=new Set();return choices.filter(next=>next.length<list.length).map(join).filter(next=>{const key=JSON.stringify(next);if(seen.has(key))return false;seen.add(key);return true;});
}
