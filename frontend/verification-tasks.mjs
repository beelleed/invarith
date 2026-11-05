import {t} from './i18n.mjs';
import {formatDateTime} from './date-format.mjs';

// Keep an immediate browser copy before the debounced, account-scoped save.
export function initVerificationTasks({api,capture,restore,isBusy,hasDraft,resumeDraft}) {
 const cacheKey='invarith-verification-tasks-v1',activeKey='invarith-active-verification-task';
 let rows=new Map(),active=null,timer,chain=Promise.resolve(true),restoring=false;
 try { const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');for(const row of cached)if(row?.id&&row.draft)rows.set(row.id,row);active=null; } catch {}
 let recovered=null;
 if(resumeDraft&&(resumeDraft.code?.trim()||resumeDraft.intent?.trim())&&![...rows.values()].some(r=>r.draft.code===resumeDraft.code&&r.draft.intent===resumeDraft.intent)){
  const now=new Date().toISOString();recovered={id:crypto.randomUUID(),title:resumeDraft.functionName||t('Untitled question'),draft:{codeLanguage:resumeDraft.codeLanguage||'python',code:resumeDraft.code||'',functionName:resumeDraft.functionName||'',intent:resumeDraft.intent||'',cases:resumeDraft.cases||'[]'},activeRunId:null,baselineRunId:null,revision:0,createdAt:now,updatedAt:now,pending:true};rows.set(recovered.id,recovered);
 }
 const make=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text)el.textContent=t(text);return el;};
 const host=make('section','verification-task-bar'),titleLabel=make('label','verification-task-title','Question title'),title=make('input',''),listLabel=make('label','verification-task-list','Saved questions'),list=make('select',''),actions=make('div','verification-task-actions'),save=make('button','secondary-button','Save now'),fresh=make('button','text-button','New question'),status=make('p','verification-task-status');
 host.setAttribute('aria-label',t('My verification questions'));title.id='verification-task-title';title.maxLength=120;title.placeholder=t('Name this question');list.id='verification-task-list';save.type=fresh.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');titleLabel.append(title);listLabel.append(list);actions.append(save,fresh);host.append(titleLabel,listLabel,actions,status);document.querySelector('.intent-section').prepend(host);
 const remember=()=>{try{const recent=[...rows.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));localStorage.setItem(cacheKey,JSON.stringify(recent.filter((row,index)=>row.pending||row.id===active||index<10)));if(active)localStorage.setItem(activeKey,active);else localStorage.removeItem(activeKey);return true;}catch{return false;}};
 const label=row=>row.title||row.draft.functionName||t('Untitled question');
 const render=()=>{list.replaceChildren();const placeholder=make('option','',active?'Select a saved question':'Current question');placeholder.value='';list.append(placeholder);for(const row of [...rows.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){const option=make('option','','');option.value=row.id;option.textContent=label(row)+' · '+formatDateTime(row.updatedAt);list.append(option);}list.value=active&&rows.has(active)?active:'';};
 const signature=row=>JSON.stringify([row.title,row.draft,row.activeRunId,row.baselineRunId]);
 const persist=row=>{
  const snapshot=structuredClone(row);
  const operation=chain.then(async()=>{
   if(active===snapshot.id)status.textContent=t('Saving question…');
   const result=await api('/api/verification-tasks',{...snapshot,revision:rows.get(snapshot.id)?.revision||0});
   const latest=rows.get(result.id);
   if(latest){rows.set(result.id,signature(latest)===signature(snapshot)?{...result,pending:false}:{...latest,revision:result.revision});remember();render();}
   if(active===snapshot.id)status.textContent=rows.get(snapshot.id)?.pending?t('Changes saved in this browser · Waiting to sync'):t('Question saved · {0}',formatDateTime(result.updatedAt));return true;
  }).catch(()=>{if(active===snapshot.id)status.textContent=t('Not synced. Your browser copy is kept. Try Save now again.');return false;});
  chain=operation;return operation;
 };
 function changed(){
  if(restoring)return;
  const snapshot=capture();if(!active)active=crypto.randomUUID();
  const previous=rows.get(active),row={id:active,title:title.value.trim(),...snapshot,revision:previous?.revision||0,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),pending:true};
  if(previous&&signature(previous)===signature(row))return;
  rows.set(active,row);const cached=remember();render();status.textContent=t(cached?'Changes saved in this browser · Waiting to sync':'Browser storage is unavailable. Keep this page open until saving finishes.');clearTimeout(timer);timer=setTimeout(()=>{void persist(rows.get(row.id));},650);
 }
 async function flush(){clearTimeout(timer);if(active&&rows.get(active)?.pending)return persist(rows.get(active));return chain;}
 function reset(){if(restoring)return;if(active){changed();void flush();}active=null;title.value='';remember();render();}
 async function open(id){
  if(!rows.has(id)||isBusy()||restoring){render();return;}
  if(!await flush()){render();return;}
  let row=rows.get(id);restoring=true;list.disabled=title.disabled=save.disabled=fresh.disabled=true;
  try{if(!row.pending){const data=await api('/api/verification-tasks');const latest=data.tasks.find(item=>item.id===id);if(latest){row=latest;rows.set(id,row);}}await restore(row);active=id;title.value=row.title;remember();render();status.textContent=row.pending?t('Changes saved in this browser · Waiting to sync'):t('Question saved · {0}',formatDateTime(row.updatedAt));}
  catch{status.textContent=t('Could not open this question. Your saved draft is kept.');}
  finally{restoring=false;list.disabled=title.disabled=save.disabled=fresh.disabled=false;}
 }
 title.addEventListener('input',changed);list.addEventListener('change',()=>void open(list.value));save.onclick=()=>{if(!isBusy()){changed();void flush();}};fresh.onclick=async()=>{if(isBusy()||restoring)return;if(await flush())document.getElementById('new-task').click();};
 window.addEventListener('online',()=>{if(active)void flush();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush();});
 title.value=rows.get(active)?.title||'';render();status.textContent=t('Loading saved questions…');
 void (async()=>{try{const data=await api('/api/verification-tasks');if(recovered&&data.tasks.some(row=>['code','intent','functionName','cases'].every(key=>row.draft[key]===recovered.draft[key]))){rows.delete(recovered.id);recovered=null;}for(const row of data.tasks){const local=rows.get(row.id);if(local&&row.id===active&&!local.pending&&local.revision!==row.revision){continue;}if(!local?.pending||signature(local)===signature(row))rows.set(row.id,{...row,pending:false});else if(local.revision===row.revision)rows.set(row.id,{...local,revision:row.revision});}remember();render();status.textContent=t('Progress saves automatically, even before you run tests.');if(active&&rows.get(active)?.pending)void flush();if(recovered)void persist(recovered);if(hasDraft&&!active)changed();}catch{status.textContent=t('Not synced. Your browser copy is kept. Try Save now again.');}})();
 return {changed,reset,flush,hasActive:()=>Boolean(active)};
}
