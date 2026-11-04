import {readdir} from 'node:fs/promises';
import {AppError} from './verification.mjs';
import {practiceTopics} from '../frontend/practice-topics.mjs';
import {practiceDifficulty} from '../frontend/practice-difficulty.mjs';

const normalize=value=>String(value||'').normalize('NFKC').toLowerCase();
function options(query){
  const q=query.q??'',topic=query.topic??'all',difficulty=query.difficulty??'all',status=query.status??'all',mode=query.mode??'all',kind=query.kind??'all',page=String(query.page??'1');
  if(typeof q!=='string'||q.length>120||!['all',...practiceTopics.map(row=>row.id)].includes(topic)||!['all','easy','medium','hard'].includes(difficulty)||!['all','not_submitted','tested_pass','needs_review'].includes(status)||!['all','coding','debug','optimize'].includes(mode)||!['all','curated','generated'].includes(kind)||!/^[1-9]\d{0,5}$/.test(page)||Number(page)>100000)throw new AppError(400,'Choose supported library filters and a search of up to 120 characters.');
  return {q:normalize(q.trim()),topic,difficulty,status,mode,kind,page:Number(page)};
}
function entry(session){
  const reports=[...Object.values(session.reports||{}),session.lastResult].filter(row=>row&&(row.action==='submit'||row.scope==='hidden_cases')&&Number.isInteger(row.total)&&row.total>0&&Number.isInteger(row.passed)&&row.passed>=0&&row.passed<=row.total&&Number.isFinite(Date.parse(row.createdAt))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const last=reports[0],difficulty=session.kind==='generated'?session.difficulty:practiceDifficulty(session.taskId||session.topic);
  return {id:session.id,title:typeof session.title==='string'?session.title:'',topic:session.topic,mode:session.mode,kind:session.kind==='generated'?'generated':'curated',difficulty:['easy','medium','hard'].includes(difficulty)?difficulty:null,createdAt:session.createdAt,isRetry:Boolean(session.retryOf),status:last?(last.passed===last.total?'tested_pass':'needs_review'):'not_submitted',latest:last?{passed:last.passed,total:last.total,createdAt:last.createdAt}:null};
}
export async function searchPractice(directory,get,query={}){
  const selected=options(query);let files;
  try{files=(await readdir(directory)).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name));}catch(error){if(error.code!=='ENOENT')throw error;files=[];}
  const matches=[];
  // Bound file concurrency; retain only public metadata after each batch.
  for(let offset=0;offset<files.length;offset+=32){
    const sessions=await Promise.all(files.slice(offset,offset+32).map(name=>get(name.slice(0,-5))));
    for(const session of sessions){const row=entry(session);if(['topic','difficulty','status','mode','kind'].some(key=>selected[key]!=='all'&&selected[key]!==row[key]))continue;
      if(selected.q&&!normalize([session.title,session.scenario,session.contract].filter(value=>typeof value==='string').join('\n')).includes(selected.q))continue;
      matches.push(row);
    }
  }
  matches.sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||a.id.localeCompare(b.id));
  const pageSize=20,total=matches.length,pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(selected.page,pages);
  return {sessions:matches.slice((page-1)*pageSize,page*pageSize),total,page,pages,pageSize};
}
