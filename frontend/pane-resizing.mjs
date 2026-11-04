import {t} from './i18n.mjs';
const storageKey='invarith-pane-layout:v1';
export const paneLayouts=[
 {selector:'.assessment-desk',first:'.assessment-context',second:'.assessment-right',axis:'x',key:'verify-width',initial:48,label:'Resize problem and code panels'},
 {selector:'.assessment-right',first:'.editor-panel',second:'.verification-output',axis:'y',key:'verify-height',initial:54,minFirst:160,minSecond:120,label:'Resize code and test panels'},
 {selector:'.ai-practice-workspace',first:'.ai-practice-question',second:'.ai-practice-editor',axis:'x',key:'practice-width',initial:43,label:'Resize problem and code panels'},
 {selector:'.ai-practice-editor',first:'.practice-code-pane',second:'.practice-output-pane',axis:'y',key:'practice-height',initial:58,minFirst:210,minSecond:130,label:'Resize code and test panels'},
 {selector:'.interview-desk',first:'.interview-conversation',second:'.interview-coding',axis:'x',key:'interview-width',initial:44,label:'Resize interview and code panels'},
 {selector:'.interview-coding',first:'.interview-code-pane',second:'.interview-output',axis:'y',key:'interview-height',initial:58,minFirst:180,minSecond:120,label:'Resize code and test panels'},
 {selector:'.oa-layout',first:'.oa-description',second:'.oa-right',axis:'x',key:'oa-width',initial:48,label:'Resize problem and code panels'},
 {selector:'.oa-right',first:'.oa-code-box',second:'.oa-case-box',axis:'y',key:'oa-height',initial:54,minFirst:160,minSecond:120,label:'Resize code and test panels'},
 {selector:'.design-lesson-player',first:'nav',second:'article',axis:'x',key:'design-lesson-width',initial:24,minFirst:140,minSecond:280,label:'Resize chapters and lesson panels'},
];
export function clampPaneRatio(value,min=10,max=90){return Math.min(max,Math.max(min,Number.isFinite(value)?value:50));}
export function installPaneResizing(root,{storage=null}={}){
 if(!root)return()=>{};
 const entries=new Map(),desktop=matchMedia('(min-width: 761px)');let prefs={},queued=false,serial=0,disposed=false;
 try{const value=JSON.parse(storage?.getItem(storageKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))prefs=value;}catch{}
 const persist=(key,ratio)=>{prefs[key]=ratio;try{storage?.setItem(storageKey,JSON.stringify(prefs));}catch{}};
 const attach=(host,config)=>{
  const first=host.querySelector(':scope > '+config.first),second=host.querySelector(':scope > '+config.second);if(!first||!second)return null;
  const handle=document.createElement('div');handle.className='pane-resizer pane-resizer-'+config.axis;handle.tabIndex=0;handle.role='separator';handle.dataset.paneKey=config.key;handle.setAttribute('aria-label',t(config.label));handle.setAttribute('aria-orientation',config.axis==='x'?'vertical':'horizontal');handle.title=t('Drag to resize. Double-click to reset. Arrow keys also work.');
  for(const pane of [first,second])if(!pane.id)pane.id='resizable-pane-'+(++serial);handle.setAttribute('aria-controls',first.id+' '+second.id);
  host.classList.add(config.axis==='x'?'resizable-columns':'resizable-rows');host.dataset.paneLayout=config.key;host.append(handle);
  let ratio=clampPaneRatio(prefs[config.key]??config.initial),drag=null;
  const sizes=()=>{const a=first.getBoundingClientRect(),b=second.getBoundingClientRect();return {a,b,total:config.axis==='x'?a.width+b.width:a.height+b.height};};
  const limits=()=>{const {total}=sizes();if(!total)return [10,90];const firstMin=config.minFirst??180,secondMin=config.minSecond??180;return [Math.min(40,firstMin/total*100),Math.max(60,100-secondMin/total*100)];};
  const position=()=>{const bounds=host.getBoundingClientRect(),{a,b}=sizes();if(!bounds.width||!bounds.height)return;const value=config.axis==='x'?(a.right+b.left)/2-bounds.left-host.clientLeft:(a.bottom+b.top)/2-bounds.top-host.clientTop;handle.style.setProperty(config.axis==='x'?'left':'top',value+'px');const [min,max]=limits();handle.setAttribute('aria-valuemin',String(Math.round(min)));handle.setAttribute('aria-valuemax',String(Math.round(max)));handle.setAttribute('aria-valuenow',String(Math.round(ratio)));handle.setAttribute('aria-valuetext',t('First panel: {0} percent',Math.round(ratio)));};
  const apply=value=>{const [min,max]=limits();ratio=clampPaneRatio(value,min,max);host.style.setProperty('--split-first',ratio+'fr');host.style.setProperty('--split-second',(100-ratio)+'fr');position();};
  const finish=(cancel=false)=>{if(!drag)return;const old=drag;drag=null;if(cancel)apply(old.ratio);else persist(config.key,ratio);handle.classList.remove('is-dragging');document.body.classList.remove('pane-dragging');document.body.style.removeProperty('--pane-cursor');try{handle.releasePointerCapture(old.pointerId);}catch{}};
  const down=event=>{if(!desktop.matches||event.button!==0||drag)return;event.preventDefault();const {total}=sizes();if(total<=0)return;drag={pointerId:event.pointerId,start:config.axis==='x'?event.clientX:event.clientY,ratio,total};handle.setPointerCapture(event.pointerId);handle.focus({preventScroll:true});handle.classList.add('is-dragging');document.body.classList.add('pane-dragging');document.body.style.setProperty('--pane-cursor',config.axis==='x'?'col-resize':'row-resize');};
  const move=event=>{if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();apply(drag.ratio+((config.axis==='x'?event.clientX:event.clientY)-drag.start)/drag.total*100);};
  const up=event=>{if(drag?.pointerId===event.pointerId)finish();};const cancel=()=>finish(true);
  const reset=()=>{finish(true);apply(config.initial);persist(config.key,ratio);};
  const keys=event=>{if(event.key==='Escape'){cancel();return;}if(!desktop.matches)return;let value;const step=event.shiftKey?10:2;if(event.key===(config.axis==='x'?'ArrowLeft':'ArrowUp'))value=ratio-step;else if(event.key===(config.axis==='x'?'ArrowRight':'ArrowDown'))value=ratio+step;else if(event.key==='Home')value=limits()[0];else if(event.key==='End')value=limits()[1];else if(event.key==='Enter'){event.preventDefault();reset();return;}else return;event.preventDefault();apply(value);persist(config.key,ratio);};
  handle.addEventListener('pointerdown',down);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',cancel);handle.addEventListener('lostpointercapture',()=>finish());handle.addEventListener('keydown',keys);handle.addEventListener('dblclick',reset);window.addEventListener('blur',cancel);
  const resized=new ResizeObserver(position);resized.observe(host);resized.observe(first);resized.observe(second);apply(ratio);
  return {handle,cancel,close(){cancel();resized.disconnect();window.removeEventListener('blur',cancel);handle.remove();host.classList.remove('resizable-columns','resizable-rows');delete host.dataset.paneLayout;host.style.removeProperty('--split-first');host.style.removeProperty('--split-second');}};
 };
 const scan=()=>{queued=false;if(disposed)return;for(const [host,entry]of entries)if(!root.contains(host)||!entry.handle.isConnected){entry.close();entries.delete(host);}for(const config of paneLayouts)for(const host of root.querySelectorAll(config.selector))if(!entries.has(host)){const entry=attach(host,config);if(entry)entries.set(host,entry);}};
 const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(scan);}});observer.observe(root,{childList:true,subtree:true});scan();
 const changed=()=>{for(const entry of entries.values())entry.cancel();document.body.classList.remove('pane-dragging');document.body.style.removeProperty('--pane-cursor');};desktop.addEventListener('change',changed);
 return()=>{disposed=true;observer.disconnect();desktop.removeEventListener('change',changed);for(const entry of entries.values())entry.close();entries.clear();};
}
