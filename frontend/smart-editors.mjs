import {EditorState,Compartment,Prec,EditorSelection} from '@codemirror/state';
import {EditorView,keymap,tooltips} from '@codemirror/view';
import {basicSetup} from 'codemirror';
import {indentMore,indentLess} from '@codemirror/commands';
import {indentUnit,StreamLanguage,syntaxHighlighting,HighlightStyle} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {autocompletion,completionStatus,acceptCompletion,setSelectedCompletion} from '@codemirror/autocomplete';
import {python} from '@codemirror/lang-python';
import {javascript} from '@codemirror/lang-javascript';
import {java} from '@codemirror/lang-java';
import {cpp} from '@codemirror/lang-cpp';
import {rust} from '@codemirror/lang-rust';
import {go} from '@codemirror/lang-go';
import {php} from '@codemirror/lang-php';
import {csharp,kotlin} from '@codemirror/legacy-modes/mode/clike';
import {ruby} from '@codemirror/legacy-modes/mode/ruby';
import {editorCompletionSource} from './editor-completions.mjs';
import {t,locale} from './i18n.mjs';

const selector='#code,#ai-practice-code,#interview-code,#oa-code,textarea.project-source';
const parsers={python:()=>python(),javascript:()=>javascript(),typescript:()=>javascript({typescript:true}),java:()=>java(),cpp:()=>cpp(),c:()=>cpp(),rust:()=>rust(),go:()=>go(),php:()=>php(),csharp:()=>StreamLanguage.define(csharp),kotlin:()=>StreamLanguage.define(kotlin),ruby:()=>StreamLanguage.define(ruby)};
const phrases={'Find':'尋找','Replace':'取代','next':'下一個','previous':'上一個','all':'全部','match case':'區分大小寫','by word':'整個單字','regexp':'正規表示式','replace':'取代','replace all':'全部取代','close':'關閉','Fold line':'摺疊此行','Unfold line':'展開此行','Go to line':'前往行號','go':'前往','Selection deleted':'已刪除選取內容','Completions':'補全建議','No diagnostics':'沒有診斷訊息'};
const theme=EditorView.theme({'&':{height:'100%',fontSize:'13px',backgroundColor:'var(--ui-code,#202129)',color:'#ded8e7'},'.cm-scroller':{overflow:'auto',fontFamily:'ui-monospace,Consolas,monospace',lineHeight:'1.8'},'.cm-content':{padding:'10px 0',caretColor:'#e7d4ff'},'.cm-gutters':{backgroundColor:'#202129',color:'#938b9f',border:'none'},'.cm-activeLineGutter':{backgroundColor:'#302c3b'},'.cm-activeLine':{backgroundColor:'#ffffff05'},'.cm-cursor,.cm-dropCursor':{borderLeftColor:'#d7b5fa'},'&.cm-focused .cm-selectionBackground,.cm-selectionBackground':{backgroundColor:'#77618b60'},'.cm-matchingBracket':{backgroundColor:'#ad85d233',outline:'1px solid #a78ac1'},'.cm-searchMatch':{backgroundColor:'#b08e4633',outline:'1px solid #b08e46'},'.cm-panels':{backgroundColor:'#2c2d36',color:'#ded8e7'},'.cm-textfield':{backgroundColor:'#202129',color:'#ded8e7',border:'1px solid #65596f'},'.cm-button':{backgroundImage:'none',backgroundColor:'#393140',color:'#ded8e7'}},{dark:true});
const colors=HighlightStyle.define([{tag:tags.keyword,color:'#c7a4ed'},{tag:[tags.string,tags.regexp],color:'#9ac6a9'},{tag:[tags.number,tags.bool,tags.null],color:'#ddb17f'},{tag:tags.comment,color:'#9b91a6',fontStyle:'italic'},{tag:tags.typeName,color:'#8fbfc8'},{tag:tags.function(tags.variableName),color:'#cfb0e9'},{tag:tags.invalid,color:'#f08da4'}]);

export function installSmartEditors(root){
 if(!root)return()=>{};
 const entries=new Map();let disposed=false,queued=false,serial=0;
 const kind=el=>el.id==='code'?'verify':el.id==='ai-practice-code'?'practice':el.id==='interview-code'?'interview':el.id==='oa-code'?'oa':'project';
 const languageFor=el=>el.id==='code'?document.getElementById('code-language')?.value||'python':el.id==='ai-practice-code'?el.closest('.ai-practice-editor')?.querySelector('.code-language-toolbar select')?.value||'python':'python';
 const attach=el=>{
  const key=kind(el),nativeBox=el.closest('.code-editor'),toolbar=document.createElement('div'),surface=document.createElement('div'),note=document.createElement('span');
  toolbar.className='smart-editor-toolbar';toolbar.dataset.editorFor=el.id||key;surface.className='smart-editor-surface';surface.dataset.editorFor=el.id||key;surface.dataset.editorKey=key;
  const group=document.createElement('div');group.setAttribute('role','group');group.setAttribute('aria-label',t('Editing mode'));note.id='editor-mode-note-'+(++serial);note.className='smart-editor-note';
  let mode='smart';try{mode=localStorage.getItem('invarith-editor-mode:'+key)==='whiteboard'?'whiteboard':'smart';}catch{}
  const buttons=['smart','whiteboard'].map(value=>{const button=document.createElement('button');button.type='button';button.textContent=t(value==='smart'?'Code editor':'Whiteboard mode');button.dataset.editorMode=value;group.append(button);button.onclick=()=>setMode(value,true);return button;});toolbar.append(group,note);
  (nativeBox||el).before(toolbar);el.after(surface);
  const ownValue=Object.getOwnPropertyDescriptor(el,'value'),prototype=HTMLTextAreaElement.prototype,originalValue=ownValue||Object.getOwnPropertyDescriptor(prototype,'value'),savedMethods=new Map();
  let language=languageFor(el),disabled=Boolean(el.disabled||el.readOnly),syncing=false,closing=false,view;
  const langSlot=new Compartment(),accessSlot=new Compartment(),completionSlot=new Compartment();
  const label=el.getAttribute('aria-label')||document.querySelector('label[for="'+el.id+'"]')?.textContent?.trim()||t('Source code');
  const shortcuts=EditorView.domEventHandlers({keydown(event){if(el.disabled||el.readOnly){if(event.key==='Escape')return false;return false;}if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();event.stopPropagation();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,bubbles:true,cancelable:true}));return true;}return false;}});
  const acceptTab=current=>{if(completionStatus(current.state)==='active'){if(!acceptCompletion(current)){current.dispatch({effects:setSelectedCompletion(0)});return acceptCompletion(current);}return true;}return indentMore(current);};
  const options=()=>[basicSetup,theme,syntaxHighlighting(colors),EditorView.contentAttributes.of({'aria-label':label,'aria-describedby':note.id}),EditorView.cspNonce.of(document.querySelector('meta[name="invarith-style-nonce"]')?.content||''),EditorState.phrases.of(locale==='zh-TW'?phrases:{}),langSlot.of((parsers[language]||parsers.python)()),indentUnit.of('    '),accessSlot.of([EditorState.readOnly.of(disabled),EditorView.editable.of(!disabled)]),completionSlot.of(autocompletion({override:[editorCompletionSource(language)],selectOnOpen:false,activateOnTypingDelay:100,tooltipClass:()=> 'invarith-completion'})),tooltips({parent:document.body}),Prec.high(keymap.of([{key:'Tab',run:acceptTab},{key:'Shift-Tab',run:indentLess}])),Prec.highest(shortcuts),
   EditorState.transactionFilter.of(tr=>{if(tr.docChanged&&!syncing&&(el.disabled||el.readOnly))return [];const limit=el.maxLength;return limit>=0&&tr.newDoc.length>limit&&tr.newDoc.length>tr.startState.doc.length?[]:tr;}),
   EditorView.updateListener.of(update=>{if(syncing||closing||mode!=='smart')return;const selection=update.state.selection.main;if(update.selectionSet||update.docChanged)prototype.setSelectionRange.call(el,selection.from,selection.to);if(update.docChanged){syncing=true;try{Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,update.state.doc.toString());prototype.setSelectionRange.call(el,selection.from,selection.to);el.dispatchEvent(new Event('input',{bubbles:true}));}finally{syncing=false;}}})];
  view=new EditorView({parent:surface,state:EditorState.create({doc:el.value,extensions:options()})});
  const sync=()=>{if(syncing||closing)return;const nextLanguage=languageFor(el),nextDisabled=Boolean(el.disabled||el.readOnly),effects=[];if(nextLanguage!==language){language=nextLanguage;effects.push(langSlot.reconfigure((parsers[language]||parsers.python)()),completionSlot.reconfigure(autocompletion({override:[editorCompletionSource(language)],selectOnOpen:false,activateOnTypingDelay:100,tooltipClass:()=> 'invarith-completion'})));}if(nextDisabled!==disabled){disabled=nextDisabled;effects.push(accessSlot.reconfigure([EditorState.readOnly.of(disabled),EditorView.editable.of(!disabled)]));}if(effects.length)view.dispatch({effects});const value=originalValue.get.call(el);if(value!==view.state.doc.toString()){syncing=true;try{const pos=Math.min(el.selectionStart||0,value.length);view.setState(EditorState.create({doc:value,selection:{anchor:pos},extensions:options()}));}finally{syncing=false;}}};
  Object.defineProperty(el,'value',{configurable:true,enumerable:ownValue?.enumerable??true,get(){return originalValue.get.call(this);},set(value){originalValue.set.call(this,value);sync();}});
  const patch=(name,fn)=>{savedMethods.set(name,Object.getOwnPropertyDescriptor(el,name));Object.defineProperty(el,name,{configurable:true,writable:true,value:fn});};
  const nativeFocus=el.focus.bind(el),nativeSelect=el.setSelectionRange.bind(el),nativeScroll=el.scrollIntoView.bind(el);
  patch('focus',options=>mode==='smart'?view.focus():nativeFocus(options));patch('scrollIntoView',options=>mode==='smart'?surface.scrollIntoView(options):nativeScroll(options));
  patch('setSelectionRange',(start,end,direction)=>{nativeSelect(start,end,direction);if(mode==='smart'){const length=view.state.doc.length,a=Math.min(Math.max(0,start),length),b=Math.min(Math.max(0,end),length);view.dispatch({selection:EditorSelection.single(direction==='backward'?b:a,direction==='backward'?a:b),scrollIntoView:true});}});
  const input=()=>sync();el.addEventListener('input',input);
  function setMode(value,focus=false){const start=el.selectionStart,end=el.selectionEnd;mode=value;el.classList.toggle('smart-source-hidden',mode==='smart');surface.hidden=mode!=='smart';surface.dataset.editorMode=mode;nativeBox?.classList.toggle('has-smart-editor',mode==='smart');buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editorMode===mode)));note.textContent=t(mode==='smart'?'Bracket pairing · Auto indent · Ctrl/⌘+Space for suggestions':'Plain text · Manual indentation');try{localStorage.setItem('invarith-editor-mode:'+key,mode);}catch{}sync();if(mode==='smart'){const length=view.state.doc.length;view.dispatch({selection:EditorSelection.single(Math.min(start,length),Math.min(end,length)),scrollIntoView:focus});view.requestMeasure();}if(focus)el.focus();}
  setMode(mode);
  const resize=new ResizeObserver(()=>{if(!closing&&!surface.hidden)view.requestMeasure();});resize.observe(surface);
  return {surface,toolbar,sync,close(){closing=true;resize.disconnect();el.removeEventListener('input',input);view.destroy();surface.remove();toolbar.remove();el.classList.remove('smart-source-hidden');nativeBox?.classList.remove('has-smart-editor');if(ownValue)Object.defineProperty(el,'value',ownValue);else delete el.value;for(const [name,descriptor]of savedMethods)if(descriptor)Object.defineProperty(el,name,descriptor);else delete el[name];}};
 };
 const scan=()=>{queued=false;if(disposed)return;for(const [el,entry]of entries)if(!root.contains(el)||!entry.surface.isConnected||!entry.toolbar.isConnected){entry.close();entries.delete(el);}for(const el of root.querySelectorAll(selector))if(!entries.has(el))entries.set(el,attach(el));for(const entry of entries.values())entry.sync();};
 const schedule=records=>{if(Array.isArray(records)&&records.length&&records.every(record=>record.target.closest?.('.cm-editor,.cm-tooltip,.smart-editor-toolbar')))return;if(!queued){queued=true;queueMicrotask(scan);}};
 const observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','class','data-editor-document']});root.addEventListener('change',schedule);scan();
 return()=>{disposed=true;observer.disconnect();root.removeEventListener('change',schedule);for(const entry of entries.values())entry.close();entries.clear();};
}
