import {t} from './i18n.mjs';

// Keep operational status and decisions visible; place implementation metadata
// in explicit, closed details without removing IDs used by the controllers.
export function simplifyProductCopy(){
  const set=(selector,message)=>{const el=document.querySelector(selector);if(el)el.textContent=t(message);};
  const details=(host,selectors)=>{
    const nodes=selectors.flatMap(selector=>[...host.querySelectorAll(selector)]);if(!nodes.length)return;
    const drawer=document.createElement('details');drawer.className='product-technical-details';
    const summary=document.createElement('summary');summary.textContent=t('Technical details');drawer.append(summary);
    for(const node of nodes)drawer.append(node);host.append(drawer);return drawer;
  };
  const lesson=document.querySelector('.walkthrough-body');
  if(lesson){
    // This repeated footer paragraph describes the implementation, not an action.
    for(const child of [...lesson.children])if(child.tagName==='SMALL')child.remove();
    details(lesson,['#lesson-voice-availability','#walkthrough-source','#walkthrough-timing','#lesson-voice-status','#teacher-sync-note']);
    const meta=document.createElement('p');meta.id='solution-generation-details';lesson.querySelector('.product-technical-details')?.append(meta);
  }
  set('.agent-intro>.agent-disclosure','Uses AI credits and sends your problem, code and tests to your model. Review expected values before running.');
  set('.mentor-panel>.ai-disclosure','Uses AI credits and sends your code and test results to your model. Verify suggestions with tests.');
  set('.history-panel>.history-help','Saved on this device. Opening a run replaces your current draft.');
  set('.learning-panel>.history-help','Predict the output, compare it with the run, and explain your reasoning. This is practice, not a skill score.');
  set('.security-panel>.history-help','Checks common Python risks. Review warnings yourself; a clean scan does not guarantee safety.');
  set('.solution-generator>p:nth-of-type(2)','Uses AI credits. Saved lessons are reused. Check generated code with tests.');
  set('.interview-disclosure','Starting is free. Follow-up questions, AI hints and feedback may use credits. Evaluation cases appear after you finish.');
  for(const selector of ['.requirements-intro','.mutation-intro','.shrink-controls','.followup-intro']){
    const host=document.querySelector(selector);if(!host)continue;
    details(host,[':scope>small']);
    const note=document.createElement('p');note.className='product-action-note';note.textContent=t(selector==='.requirements-intro'||selector==='.followup-intro'?'Uses AI credits when requested. Review proposals before using them.':'Runs locally. No AI credits.');host.insertBefore(note,host.querySelector('.product-technical-details'));
  }
  const trace=document.querySelector('.trace-intro');if(trace)details(trace,['#trace-limit']);
  const security=document.querySelector('.security-toolbar');if(security)details(security,[':scope>p']);
}
