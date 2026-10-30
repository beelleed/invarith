import React,{useEffect,useRef,useState} from 'react';
import {locale,t} from '../i18n.mjs';
import {NoteRecall} from './NoteRecall.jsx';
import {createRecallRound,restoreRecallRound,recallableNotes,recallStorageKey} from '../note-recall.mjs';
const tags=[['boundaries','Boundary conditions'],['requirements','Reading the requirement'],['invariant','Loop invariant'],['data_structure','Choosing a data structure'],['complexity','Time and space complexity'],['implementation','Implementation detail']];
const empty={observation:'',nextTime:'',tags:[]};
const fields=value=>({observation:value.observation,nextTime:value.nextTime,tags:value.tags});
const equal=(a,b)=>JSON.stringify(fields(a))===JSON.stringify(fields(b));
async function request(path,body){const response=await fetch(path,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Could not load practice notes.'),{status:response.status});return data;}
export function PracticeNotes({session}){
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [saved,setSaved]=useState(null),[draft,setDraft]=useState(empty),[saving,setSaving]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
  const key='invarith-practice-note:'+session.id;
  useEffect(()=>{let alive=true;void(async()=>{try{const note=await request('/api/practice-notes/'+session.id);let backup;try{backup=JSON.parse(localStorage.getItem(key));}catch{}
    const valid=backup&&typeof backup.observation==='string'&&backup.observation.length<=3000&&typeof backup.nextTime==='string'&&backup.nextTime.length<=3000&&Array.isArray(backup.tags)&&backup.tags.every(id=>tags.some(([tag])=>tag===id));
    if(alive){setSaved(note);setDraft(valid?fields(backup):fields(note));if(valid&&!equal(backup,note)&&(backup.conflict||backup.revision!==note.revision))setConflict(true);}
  }catch(e){if(alive)setError(t(e.message));}})();return()=>{alive=false;};},[session.id]);
  useEffect(()=>{if(!saved)return;try{if(equal(draft,saved))localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({...draft,revision:saved.revision,conflict}));}catch{}},[draft,saved,conflict]);
  useEffect(()=>{if(!saved||saving||error||conflict||equal(draft,saved))return;const timer=setTimeout(()=>{setSaving(true);void request('/api/practice-notes',{id:session.id,revision:saved.revision,...draft}).then(note=>{if(mounted.current)setSaved(note);document.dispatchEvent(new Event('practice-notes-changed'));}).catch(async e=>{if(!mounted.current)return;setError(t(e.message));if(e.status===409){setConflict(true);try{const current=await request('/api/practice-notes/'+session.id);if(mounted.current)setSaved(current);}catch{}}}).finally(()=>{if(mounted.current)setSaving(false);});},700);
    // A save in flight must finish before a later edit starts another save.
    return()=>{clearTimeout(timer);};
  },[draft,saved,saving,error,conflict]);
  const edit=change=>setDraft(current=>{const next={...current,...change};try{localStorage.setItem(key,JSON.stringify({...next,revision:saved?.revision??0,conflict}));}catch{}return next;});
  const dirty=saved&&!equal(draft,saved);
  return <section className="practice-note-editor" aria-label={t('My solution notes')}><header><h4>{t('My solution notes')}</h4><span role="status">{t(saving?'Saving note…':conflict?'Review a conflicting save':error?'Note not saved':!saved?'Loading notes…':dirty?'Saving soon…':'Note saved')}</span></header><p>{t('Keep the reasoning you want to remember. These are your own observations.')}</p>
    {error&&<p role="alert">{error}</p>}
    {conflict&&saved&&<div className="practice-note-conflict"><strong>{t('Saved version')}</strong><p>{saved.observation}</p><p>{saved.nextTime}</p><small>{saved.tags.map(id=>t(tags.find(([tag])=>tag===id)?.[1]||id)).join(' · ')}</small><div><button onClick={()=>{setDraft(fields(saved));setConflict(false);setError('');}}>{t('Use saved note')}</button><button onClick={()=>{setConflict(false);setError('');}}>{t('Replace with my draft')}</button></div></div>}
    <label>{t('What did I learn or miss?')}<textarea maxLength={3000} disabled={!saved} value={draft.observation} onChange={e=>edit({observation:e.target.value})} placeholder={t('Example: I excluded the case where the balance equals the withdrawal.')}/></label>
    <label>{t('What will I check next time?')}<textarea maxLength={3000} disabled={!saved} value={draft.nextTime} onChange={e=>edit({nextTime:e.target.value})} placeholder={t('Example: Test below, at, and above the boundary before submitting.')}/></label>
    <fieldset disabled={!saved}><legend>{t('My review tags')}</legend><div className="practice-note-tags">{tags.map(([id,label])=><button type="button" key={id} aria-pressed={draft.tags.includes(id)} onClick={()=>edit({tags:draft.tags.includes(id)?draft.tags.filter(tag=>tag!==id):[...draft.tags,id]})}>{t(label)}</button>)}</div></fieldset>
    {error&&!conflict&&saved&&<button className="secondary-button" onClick={()=>setError('')}>{t('Retry saving note')}</button>}
  </section>;
}

export function PracticeNotebook({onOpen}){
  const [notes,setNotes]=useState(null),[error,setError]=useState(''),[tag,setTag]=useState('all'),[search,setSearch]=useState('');
  const [recall,setRecall]=useState(null);
  useEffect(()=>{let alive=true,seq=0;const refresh=async()=>{const current=++seq;try{const data=await request('/api/practice-notes');if(alive&&seq===current){setNotes(data.notes);setError('');}}catch(e){if(alive&&seq===current)setError(t(e.message));}};void refresh();window.addEventListener('focus',refresh);document.addEventListener('practice-notes-changed',refresh);return()=>{alive=false;window.removeEventListener('focus',refresh);document.removeEventListener('practice-notes-changed',refresh);};},[]);
  const query=search.trim().toLocaleLowerCase(),rows=(notes||[]).filter(note=>(tag==='all'||note.tags.includes(tag))&&(!query||[note.title,note.observation,note.nextTime].join(' ').toLocaleLowerCase().includes(query)));
  const eligible=recallableNotes(rows);let savedRound;try{savedRound=restoreRecallRound(localStorage.getItem(recallStorageKey),notes||[]);}catch{}
  if(recall)return <NoteRecall initialRound={recall} notes={notes||[]} onClose={()=>setRecall(null)} onOpen={onOpen}/>;
  return <section className="practice-notebook" aria-label={t('My learning notebook')}><header><div><h3>{t('My learning notebook')}</h3><p>{t('Your notes, grouped by what you want to practice again.')}</p></div><span>{t('{0} saved notes',notes?.length||0)}</span></header><div className="practice-notebook-tools"><label>{t('Filter by review tag')}<select value={tag} onChange={e=>setTag(e.target.value)}><option value="all">{t('All notes')}</option>{tags.map(([id,label])=><option key={id} value={id}>{t(label)} ({(notes||[]).filter(n=>n.tags.includes(id)).length})</option>)}</select></label><label>{t('Search my notes')}<input maxLength={200} type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <div className="practice-notebook-recall"><button className="secondary-button" disabled={!eligible.length} onClick={()=>setRecall(createRecallRound(eligible))}>{t('Practice recalling these notes')} ({eligible.length})</button>{savedRound&&<button className="text-button" onClick={()=>setRecall(savedRound)}>{t(savedRound.position===savedRound.cards.length?'View my last recall round':'Resume recall round')}</button>}<small>{t('Explain the idea first, then reveal your notes. Your self-checks stay separate from test results.')}</small></div>
    {error&&<p role="alert">{error}</p>}{!notes&&!error&&<p>{t('Loading notes…')}</p>}
    {rows.slice(0,30).map(note=><article className="practice-notebook-row" key={note.id}><header><strong>{note.title}</strong><small>{new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(note.updatedAt))}</small></header>{note.observation&&<p>{note.observation}</p>}{note.nextTime&&<p><b>{t('Next time')}: </b>{note.nextTime}</p>}<footer><span>{note.tags.map(id=>t(tags.find(([tag])=>tag===id)?.[1]||id)).join(' · ')}</span><button className="text-button" onClick={()=>onOpen({id:note.topic,latest:{sessionId:note.id}})}>{t('Open question and notes')} ↗</button></footer></article>)}
    {notes&&!rows.length&&<p>{t(notes.length?'No notes match this filter.':'Write a note below a practice question to start your notebook.')}</p>}
    {rows.length>30&&<small>{t('Showing the 30 most recently updated matches. Use a tag or search to narrow the list.')}</small>}
  </section>;
}
