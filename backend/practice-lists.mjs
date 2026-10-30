import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError} from './verification.mjs';

export function createPracticeLists({directory='./data/practice-lists',practice,now=()=>Date.now()}={}){
  let busy=false;const path=join(directory,'index.json');
  const read=async()=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return {revision:0,lists:[]};throw e;}};
  const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>60)throw new AppError(400,'Use a list name between 1 and 60 characters.');return value.trim();};
  const item=async id=>{if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new AppError(404,'Practice not found.');const task=await practice.open(id);return {practiceId:id,title:task.title,topic:task.topic,kind:task.kind||'curated',addedAt:new Date(now()).toISOString()};};
  const find=(data,id)=>{const list=data.lists.find(l=>l.id===id);if(!list)throw new AppError(404,'Practice list not found.');return list;};
  return {
    list:read,
    async detail(id){const data=await read(),list=find(data,id),items=[];
      for(const entry of list.items){try{const task=await practice.open(entry.practiceId),result=task.attempts?.at(-1)||(task.lastResult?.scope==='hidden_cases'?task.lastResult:null);const valid=result&&Number.isInteger(result.total)&&result.total>0&&Number.isInteger(result.passed)&&result.passed>=0&&result.passed<=result.total;
        items.push({...entry,title:task.title,topic:task.topic,contractId:task.taskId||null,available:true,lastTest:valid?{passed:result.passed,total:result.total,createdAt:result.createdAt||null}:null});
      }catch(e){if(e.status!==404)throw e;items.push({...entry,available:false,lastTest:null});}}
      return {revision:data.revision,list:{...list,items}};
    },
    async change(body){
      if(!['create','rename','delete','add','remove','move'].includes(body.action)||!Number.isInteger(body.revision)||body.revision<0)throw new AppError(400,'Choose a supported list action and revision.');
      if(busy)throw new AppError(429,'A practice list is being saved. Please retry.');busy=true;
      try{const data=await read();if(body.revision!==data.revision)throw new AppError(409,'Your practice lists changed elsewhere. Reload them and try again.');const stamp=new Date(now()).toISOString();let list;
        if(body.action==='create'){
          if(data.lists.length>=20)throw new AppError(400,'You can keep up to 20 practice lists.');const title=name(body.name);
          if(data.lists.some(l=>l.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new AppError(400,'A practice list already uses this name.');
          list={id:randomUUID(),name:title,createdAt:stamp,updatedAt:stamp,items:body.practiceId===undefined?[]:[await item(body.practiceId)]};data.lists.push(list);
        }else{list=find(data,body.id);
          if(body.action==='rename'){const title=name(body.name);if(data.lists.some(l=>l.id!==list.id&&l.name.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new AppError(400,'A practice list already uses this name.');list.name=title;}
          if(body.action==='delete')data.lists=data.lists.filter(l=>l.id!==list.id);
          if(body.action==='add'){if(list.items.some(i=>i.practiceId===body.practiceId))return {...data,selectedId:list.id};if(list.items.length>=100)throw new AppError(400,'A practice list can hold up to 100 questions.');list.items.push(await item(body.practiceId));}
          if(['remove','move'].includes(body.action)){const index=list.items.findIndex(i=>i.practiceId===body.practiceId);if(index<0)throw new AppError(404,'This question is not in the list.');if(body.action==='remove')list.items.splice(index,1);else{const next=index+body.direction;if(![-1,1].includes(body.direction)||next<0||next>=list.items.length)throw new AppError(400,'Choose a valid question order.');[list.items[index],list.items[next]]=[list.items[next],list.items[index]];}}
          list.updatedAt=stamp;
        }
        data.revision++;await mkdir(directory,{recursive:true});const temp=join(directory,randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(data),{mode:0o600});await rename(temp,path);return {...data,selectedId:body.action==='delete'?data.lists[0]?.id||'':list.id};
      }finally{busy=false;}
    }
  };
}
