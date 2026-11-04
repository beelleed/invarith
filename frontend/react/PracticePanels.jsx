import React,{useId} from 'react';
import {t} from '../i18n.mjs';
import {nextPracticePanel} from '../practice-panels.mjs';
export function PracticePanels({label,items,value,onChange,panels,badges={}}){
  const base=useId(),selected=items.some(([id])=>id===value)?value:items[0][0];
  const select=(id,event)=>{onChange(id);if(event){event.preventDefault();event.currentTarget.parentElement.querySelector(`[data-panel="${id}"]`)?.focus();}};
  return <div className="practice-panel-group"><nav className="practice-panel-tabs" role="tablist" aria-label={t(label)}>{items.map(([id,title])=><button type="button" role="tab" id={base+'-'+id+'-tab'} aria-controls={base+'-'+id+'-panel'} aria-selected={selected===id} tabIndex={selected===id?0:-1} data-panel={id} key={id} onClick={()=>select(id)} onKeyDown={event=>{const next=nextPracticePanel(items,id,event.key);if(next)select(next,event);}}>{t(title)}{badges[id]&&<span>{badges[id]}</span>}</button>)}</nav>{items.map(([id])=><div key={id} id={base+'-'+id+'-panel'} role="tabpanel" aria-labelledby={base+'-'+id+'-tab'} tabIndex={0} hidden={selected!==id}>{panels[id]}</div>)}</div>;
}
