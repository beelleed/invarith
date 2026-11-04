import {t} from './i18n.mjs';
const owners=new WeakMap();
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text)element.textContent=t(text);return element;};
export function revealWorkbench(element){
  for(let parent=element;parent;parent=parent.parentElement)owners.get(parent)?.();
}
export function toolTabs(host,id,label,entries){
  const tabs=node('div','desk-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',t(label));host.append(tabs);
  const items=entries.map(([key,title,elements])=>{
    const button=node('button','desk-tab',title),pane=node('section','desk-pane');button.type='button';button.id=`${id}-${key}-tab`;pane.id=`${id}-${key}-pane`;pane.tabIndex=0;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);
    tabs.append(button);pane.append(...elements.filter(Boolean));host.append(pane);return {key,button,pane};
  });
  const show=key=>{for(const item of items){const active=item.key===key;item.pane.hidden=!active;item.button.setAttribute('aria-selected',String(active));item.button.tabIndex=active?0:-1;}};
  items.forEach((item,index)=>{owners.set(item.pane,()=>show(item.key));item.button.addEventListener('click',()=>show(item.key));item.button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%items.length;else if(event.key==='ArrowLeft')next=(index+items.length-1)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();show(items[next].key);items[next].button.focus();});});
  if(items.length)show(items[0].key);return {show};
}
export function initVerificationDesk(screen){
  const editor=screen.querySelector('.editor-panel');if(!editor)return;
  const find=selector=>screen.querySelector(selector),take=selectors=>selectors.map(find).filter(Boolean);
  const desk=node('div','verification-desk assessment-desk'),output=node('div','verification-output');
  const description=node('div','assessment-description'),cases=node('div','assessment-testcases');
  description.append(...take(['#lesson-import-note','.intent-section','.function-row','.challenge-box']));
  cases.append(...take(['.test-heading','#tests-help','#regression-guard','#case-cards','.advanced-cases']));
  toolTabs(output,'verification-output','Verification tools',[
    ['cases','Test cases',[cases]],
    ['results','Results',take(['.evidence-panel'])],['trace','Execution trace',take(['.trace-panel'])],['compare','Before & after',take(['.comparison-panel'])]
  ]);
  const tools=node('div','verification-tools assessment-context');
  toolTabs(tools,'verification-tools','More verification tools',[
    ['description','Description',[description]],['mentor','Mentor',take(['.mentor-panel'])],['plan','AI test plan',take(['.agent-panel'])],['history','History',take(['.history-panel','.execution-panel'])],['checks','More checks',take(['.requirements-panel','.mutation-panel','.challenge-next-panel','.shrink-panel','.security-panel'])],['repair','Repair practice',take(['.repair-panel'])]
  ]);
  screen.querySelectorAll(':scope>.tool-drawer').forEach(drawer=>drawer.remove());
  const workflow=find('.workflow');if(workflow)workflow.hidden=true;
  const right=node('div','assessment-right'),actions=node('div','assessment-run-actions');
  const runRow=editor.querySelector('.run-row');if(runRow)actions.append(runRow);
  right.append(editor,output);desk.append(tools,right);screen.prepend(actions);screen.append(desk);
  document.getElementById('run-button')?.addEventListener('click',()=>revealWorkbench(output.querySelector('.evidence-panel')));
}
export function initInterviewDesk(screen){
  const body=screen.querySelector('.interview-body'),session=body?.querySelector('#interview-session');if(!session)return;
  const children=[...session.children],get=id=>session.querySelector(`#${id}`),take=(a,b)=>children.slice(a,b);
  const introduction=[...body.children].filter(child=>child!==session),setup=node('div','interview-configuration');setup.append(...introduction);
  const intro=node('header','interview-question-heading');intro.append(...take(0,6));
  const grid=node('div','interview-desk'),conversation=node('div','interview-conversation'),coding=node('div','interview-coding');
  toolTabs(conversation,'interview-conversation','Interview conversation',[
    ['question','Interview prompt',[children[7],children[8],...take(10,14)]],['board','Whiteboard',[children[9]]],['transcript','Conversation history',[children[6]]]
  ]);
  const codeHeader=node('div','desk-file-heading','solution.py');const language=node('span',null,'Python');codeHeader.append(language);
  const code=get('interview-code'),label=children[14],codeActions=children[18];
  const codePane=node('div','interview-code-pane');codePane.append(label,codeHeader,code,children[17],codeActions,children[19]);coding.append(codePane);
  const tests=children[16];tests.open=true;tests.classList.add('interview-own-tests');
  const output=node('div','interview-output');
  const outputTabs=toolTabs(output,'interview-output','Interview results',[
    ['cases','My tests',[tests]],['results','Results & review',[children[20],children[21],children[22]]]
  ]);
  coding.append(output);grid.append(conversation,coding);session.replaceChildren(intro,grid);
  const room=node('div','interview-room');body.append(room);
  const roomTabs=toolTabs(room,'interview-room','Interview workspace',[
    ['session','Interview room',[session]],['setup','New interview', [setup]]
  ]);
  let currentId=null,currentStatus=null;
  roomTabs.show('setup');
  document.addEventListener('interview-session-updated',event=>{const {id,status}=event.detail;if(id!==currentId||status!==currentStatus){currentId=id;currentStatus=status;roomTabs.show('session');if(status==='finished')outputTabs.show('results');}});
  document.addEventListener('interview-evidence-updated',()=>outputTabs.show('results'));
  const empty=node('div','interview-room-empty');empty.append(node('h3',null,'Your next interview starts here.'),node('p',null,'Choose a coaching or strict interviewer, then start a session.'));
  const start=node('button','primary-button','Set up an interview');start.type='button';start.addEventListener('click',()=>roomTabs.show('setup'));empty.append(start);session.before(empty);
  const observer=new MutationObserver(()=>{empty.hidden=!session.hidden;});observer.observe(session,{attributes:true,attributeFilter:['hidden']});empty.hidden=!session.hidden;
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
}
