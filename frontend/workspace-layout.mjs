import { mountReactWorkspace } from './react-shell.mjs';
import { simplifyProductCopy } from './product-copy.mjs';
import { t } from './i18n.mjs';
import {initVerificationDesk,initInterviewDesk,revealWorkbench} from './workbench.mjs';

const modes={verify:{title:'Verify your code',description:'Describe the behavior, test it, then inspect the evidence.'},learn:{title:'Learn to debug',description:'Build intuition with a lesson, then practice the method.'},interview:{title:'Practice an interview',description:'Choose a coaching or strict interviewer and explain your reasoning.'},oa:{title:'OA simulation',description:'Multiple questions. One timer. Your own reasoning.'}};
export function modeForTarget(target=''){
  if(/^(oa|assessment)/.test(target))return 'oa';
  if(/walkthrough|teacher|lesson|learning|memory/.test(target))return 'learn';
  if(/interview/.test(target))return 'interview';
  return 'verify';
}
export function revealWorkspace(target){
  if(typeof document==='undefined')return;
  const element=typeof target==='string'?document.getElementById(target):target;
  if(!element)return;
  const screen=element.closest('[data-screen]');
  if(screen)document.dispatchEvent(new CustomEvent('workspace-mode',{detail:{mode:screen.dataset.screen}}));
  revealWorkbench(element);
  let parent=element.parentElement;
  while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}
  if(screen)document.dispatchEvent(new CustomEvent('workspace-target-revealed',{detail:{mode:screen.dataset.screen,id:element.id}}));
}
export function initWorkspaceLayout(){
  const main=document.querySelector('main'),oldGrid=document.querySelector('.work-grid');
  const make=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text)el.textContent=t(text);return el;};
  const screens={};
  for(const key of Object.keys(modes)){const screen=make('div','mode-screen');screen.id=`mode-${key}`;screen.dataset.screen=key;screens[key]=screen;main.append(screen);}
  const move=(selector,container)=>{const el=document.querySelector(selector);if(el)container.append(el);return el;};
  const fold=(label,container,selectors)=>{const details=make('details','tool-drawer');details.append(make('summary','',label));container.append(details);selectors.forEach(s=>move(s,details));return details;};
  move('.workflow',screens.verify);
  move('.editor-panel',screens.verify);
  fold('Generate tests with AI',screens.verify,['.agent-panel']);
  move('[aria-labelledby="evidence-heading"]',screens.verify);
  move('.comparison-panel',screens.verify);
  fold('Understand a failure',screens.verify,['.mentor-panel','.trace-panel']);
  fold('More verification tools',screens.verify,['.repair-panel','.requirements-panel','.mutation-panel','.challenge-next-panel','.shrink-panel','.security-panel']);
  fold('History & execution settings',screens.verify,['.history-panel','.execution-panel']);
  move('.walkthrough-panel',screens.learn);
  const library=document.querySelector('.lesson-library'),libraryDrawer=document.createElement('section');libraryDrawer.className='tool-drawer lesson-ready-library';
  const librarySummary=document.createElement('h3');librarySummary.textContent=t('Built-in lessons & recorded execution replay');libraryDrawer.append(librarySummary);library.before(libraryDrawer);
  libraryDrawer.append(library,document.querySelector('.teacher-voice-settings'),document.getElementById('walkthrough-workspace').closest('.walkthrough-actions'));
  fold('Practice & learning history',screens.learn,['.learning-panel','.memory-panel']);
  move('.interview-panel',screens.interview);
  initVerificationDesk(screens.verify);
  initInterviewDesk(screens.interview);
  oldGrid?.remove();
  for(const selector of ['.environment-bar','footer']){const element=main.querySelector(selector);if(element)main.append(element);}
  // The three modes retain their DOM nodes and drafts while switching.
  const nav=document.querySelector('.sidebar nav');
  for(const id of ['trace-nav','agent-nav','requirements-nav','mutation-nav','mentor-nav'])document.getElementById(id).hidden=true;
  const navIds={verify:'workspace-nav',learn:'walkthrough-nav',interview:'interview-nav'};
  for(const [key,id]of Object.entries(navIds)){const button=document.getElementById(id);button.textContent=t(modes[key].title);button.dataset.mode=key;nav.prepend(button);}
  nav.prepend(document.getElementById('workspace-nav'));nav.insertBefore(document.getElementById('walkthrough-nav'),document.getElementById('interview-nav'));
  document.querySelector('.sidebar-note').hidden=true;
  const h1=document.querySelector('.page-heading h1'),description=document.querySelector('.page-heading p'),breadcrumb=document.querySelector('.breadcrumb strong');
  const switchMode=(key,scroll=false)=>{if(!modes[key])key='verify';for(const [name,screen]of Object.entries(screens))screen.hidden=name!==key;
    for(const [name,id]of Object.entries(navIds)){const button=document.getElementById(id);button.classList.toggle('active',name===key);if(name===key)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
    h1.textContent=t(modes[key].title);description.textContent=t(modes[key].description);breadcrumb.textContent=t(modes[key].title);document.body.dataset.mode=key;
    document.querySelector('.page-heading .example-trigger').hidden=key!=='verify';
    document.dispatchEvent(new CustomEvent('workspace-view-changed',{detail:{mode:key}}));
    if(key!=='learn')document.dispatchEvent(new Event('workspace-leave-lesson'));
    if(scroll)window.scrollTo({top:0,behavior:'smooth'});
  };
  document.addEventListener('workspace-mode',e=>switchMode(e.detail.mode));
  document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
    if(button.dataset.mode){event.preventDefault();event.stopImmediatePropagation();switchMode(button.dataset.mode,true);history.replaceState(null,'',`#mode-${button.dataset.mode}`);return;}
    const text=button.textContent.trim(),targets=new Map([[t('Need a hint? Open mentor'),'mentor-heading'],[t('See execution steps →'),'trace-heading'],[t('Explore execution ↗'),'trace-heading'],[t('Inspect before & after'),'comparison-heading'],[t('See before & after'),'comparison-heading'],[t('Edit my code'),'code-heading']]);
    if(targets.has(text))revealWorkspace(targets.get(text));
    if(button.classList.contains('example-trigger') || button.id==='examples-nav')switchMode('verify');
  },true);
  const applyHash=()=>{const id=location.hash.slice(1);switchMode(id.startsWith('mode-')?id.slice(5):modeForTarget(id));if(id && !id.startsWith('mode-'))revealWorkspace(id);};
  window.addEventListener('hashchange',applyHash);applyHash();
  // Hide technical playback options until requested.
  const stage=document.getElementById('walkthrough-stage');
  const settings=fold('Playback settings',stage,[]);
  for(const selector of ['.lesson-playback-options','#lesson-chapters','#walkthrough-seek']){const control=document.querySelector(selector);const label=control?.previousElementSibling;if(label?.tagName==='LABEL')settings.append(label);if(control)settings.append(control);}
  stage.insertBefore(settings,document.getElementById('walkthrough-count'));
  const theatre=make('button','secondary-button','Theater view');theatre.type='button';theatre.setAttribute('aria-pressed','false');
  theatre.addEventListener('click',()=>{const expanded=stage.classList.toggle('theater');theatre.setAttribute('aria-pressed',String(expanded));theatre.textContent=t(expanded?'Exit theater view':'Theater view');});
  document.getElementById('walkthrough-play').closest('.walkthrough-actions').append(theatre);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){stage.classList.remove('theater');theatre.setAttribute('aria-pressed','false');theatre.textContent=t('Theater view');}});
  simplifyProductCopy();
  const footer=document.createElement('div');const environment=document.querySelector('.environment-bar');if(environment)footer.append(environment);
  mountReactWorkspace({screens,footer,initialMode:document.body.dataset.mode||'verify',onMode:key=>{switchMode(key,true);history.replaceState(null,'',`#mode-${key}`);},onReveal:id=>{revealWorkspace(id);requestAnimationFrame(()=>{revealWorkspace(id);document.getElementById(id)?.scrollIntoView({block:'start',behavior:'smooth'});});}});
}
