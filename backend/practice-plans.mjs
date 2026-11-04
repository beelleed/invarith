import {readdir} from 'node:fs/promises';
import {AppError} from './verification.mjs';
import {validSavedPlan} from './practice-plan.mjs';
import {practiceTopics} from '../frontend/practice-topics.mjs';
import {solutionPlanFields} from '../frontend/solution-plan.mjs';
const normalize=value=>value.normalize('NFKC').toLowerCase();
export async function searchPracticePlans(directory,get,query={}){
  const q=query.q??'',topic=query.topic??'all',page=String(query.page??'1');
  if(typeof q!=='string'||q.length>120||!['all',...practiceTopics.map(t=>t.id)].includes(topic)||!/^[1-9]\d{0,5}$/.test(page))throw new AppError(400,'Choose a supported plan topic and a search of up to 120 characters.');
  const search=normalize(q.trim()),matches=[];let files=[];
  try{files=(await readdir(directory)).filter(f=>/^[a-f0-9-]{36}\.json$/.test(f));}catch(error){if(error.code!=='ENOENT')throw error;}
  for(let i=0;i<files.length;i+=32){
    const rows=await Promise.all(files.slice(i,i+32).map(file=>get(file.slice(0,-5))));
    for(const session of rows){const plan=session.solutionPlan;if(!validSavedPlan(plan)||!solutionPlanFields.some(key=>plan[key].trim())||topic!=='all'&&session.topic!==topic)continue;
      if(search&&!normalize([session.title||'',...solutionPlanFields.map(key=>plan[key])].join('\n')).includes(search))continue;
      matches.push({id:session.id,title:session.title,topic:session.topic,contract:session.contract,plan:{revision:plan.revision,updatedAt:plan.updatedAt,...Object.fromEntries(solutionPlanFields.map(key=>[key,plan[key]]))}});
    }
  }
  matches.sort((a,b)=>Date.parse(b.plan.updatedAt)-Date.parse(a.plan.updatedAt)||a.id.localeCompare(b.id));
  const pageSize=20,pages=Math.max(1,Math.ceil(matches.length/pageSize)),selected=Math.min(Number(page),pages);
  return {plans:matches.slice((selected-1)*pageSize,selected*pageSize),total:matches.length,page:selected,pages,pageSize};
}
