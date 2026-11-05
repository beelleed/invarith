import {formatDateTime,formatTime} from './date-format.mjs';
import {initVerificationTasks} from './verification-tasks.mjs';
import {reportPresentation} from './report-localization.mjs';
import {confirmAction} from './confirm-action.mjs';
import {codeLanguages,languageStarter,languageInstructions} from './code-languages.mjs';
import {libraryProblem} from './problem-library.mjs';
import { lessonVerificationDraft, captureEditorDraft, restoreEditorDraft } from './lesson-verification.mjs';
import { initWorkspaceLayout, revealWorkspace } from './workspace-layout.mjs';
import { t, locale, initLanguageLinks } from './i18n.mjs';
initLanguageLinks();
const hintLanguage=locale==='zh-TW'?'zh-TW':'en-US';
const matchesHintLanguage=hint=>(hint?.language||'en-US')===hintLanguage;
// Migrate only unchanged bundled examples; preserve user-authored drafts.
const legacyExampleCodes = ["# \u8a08\u7b97\u6e05\u55ae\u5e73\u5747\u503c；\u7a7a\u6e05\u55ae\u61c9\u56de\u50b3 0\n# \u8a66\u8457\u627e\u51fa\u6c92\u6709\u88ab\u8655\u7406\u7684\u908a\u754c\u60c5\u6cc1。\n\ndef average(numbers):\n    total = sum(numbers)\n    return total / len(numbers)\n","# \u56de\u50b3\u6e05\u55ae\u4e2d\u7684\u7b2c\u4e00\u500b\u5076\u6578；\u627e\u4e0d\u5230\u5247\u56de\u50b3 None。\n\ndef first_even(numbers):\n    for i in range(len(numbers) - 1):\n        if numbers[i] % 2 == 0:\n            return numbers[i]\n    return None\n","# \u5ffd\u7565\u5927\u5c0f\u5beb\u8207\u7a7a\u683c，\u5224\u65b7\u6587\u5b57\u662f\u5426\u70ba\u56de\u6587。\n\ndef is_palindrome(text):\n    normalized = text.lower()\n    return normalized == normalized[::-1]\n"];
import { challengePacks, appendChallenge, caseKey, compareRuns, codeDiff, canonical } from './evidence-tools.mjs';
import { deliveryDemo, matchesDeliverySuite, repairOutcome } from './repair-journey.mjs';
import { callLabel, outputLabel, sameTask, repairProgress } from './evidence-view.mjs';
import { transferPractices } from './transfer-practice.mjs';
import { readableReport } from './readable-report.mjs';
import { matchesRegression } from './regression-tools.mjs';
import { shrinkContracts, shrinkableCase } from './shrink-contracts.mjs';
import { requirementCoverage, requirementLabels } from './requirement-tools.mjs';
import { initInterview } from './interview-ui.mjs';
import { initWalkthrough } from './lesson-player.mjs';
const $ = selector => document.querySelector(selector);
const examples = [
  {
    title: t("Binary search: the last candidate"), tag: t("01 / Execution paths"),
    description: t("Find the first matching index. Can the loop skip the final candidate or return a later duplicate?"),
    functionName: 'search',
    code: 'def search(nums, target):\n    left, right = 0, len(nums) - 1\n    while left < right:\n        mid = (left + right) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1\n',
    cases: [{ args: [[1, 3, 5], 3], expected: 1 }, { args: [[1, 3, 5, 7, 9], 7], expected: 3 }, { args: [[1, 3, 5], 4], expected: -1 }],
  },
  {
    title: t("The empty average"), tag: t("02 / Edge cases"),
    description: t("Ordinary inputs work. But what should an empty list return?"),
    functionName: 'average',
    code: '# Return the average of a list; return 0 for an empty list.\n# Find the edge case that has not been handled.\n\ndef average(numbers):\n    total = sum(numbers)\n    return total / len(numbers)\n',
    cases: [{ args: [[2, 4, 6]], expected: 4 }, { args: [[10]], expected: 10 }, { args: [[1, 2]], expected: 1.5 }],
  },
  {
    title: t("The missing last item"), tag: t("03 / Loop boundaries"),
    description: t("Find the first even number. What if it is the last item?"),
    functionName: 'first_even',
    code: '# Return the first even number, or None if there is none.\n\ndef first_even(numbers):\n    for i in range(len(numbers) - 1):\n        if numbers[i] % 2 == 0:\n            return numbers[i]\n    return None\n',
    cases: [{ args: [[2, 3, 5]], expected: 2 }, { args: [[1, 4, 5]], expected: 4 }, { args: [[1, 3]], expected: null }],
  },
  {
    title: t("Almost the same text"), tag: t("04 / Normalization"),
    description: t("A palindrome check should ignore case and spaces. Does it?"),
    functionName: 'is_palindrome',
    code: '# Check for a palindrome, ignoring case and spaces.\n\ndef is_palindrome(text):\n    normalized = text.lower()\n    return normalized == normalized[::-1]\n',
    cases: [{ args: ['Level'], expected: true }, { args: ['abba'], expected: true }, { args: ['Python'], expected: false }],
  },
];
let evidence = null, runSnapshot = null, health = null, busy = false, hintBusy = false, level = 1;
let hints = {}, toastTimer, saveTimer;
let selectedExample = 'average', confirmedContract = null, baseline = null, challengeProvenance = null, runProvenance = null;
let editingCase = null, traceIndex = 0, traceStep = 0;
let agentPlan = null, planSnapshot = null, reviewedPlan = null, planBusy = false, confirmingPlan = false;
let repairJourney = null;
let hintDetails = {}, historyBusy = false, restoredEvidence = false, hasDraft = false;
let learning = {}, learnerDraft = { caseIndex: 0, predictionText: '', answer: '', answerRunId: null }, mentorBusy = false;
let selectedPracticeId = null;
let securityPreview=null;
let replaySuite=null, regressionPreview=null;
let requirementDraft=null,requirementPhase=null;
let mutationBusy=false;
let interviewUI=null;
let walkthroughUI=null;
let verificationTasks=null;
const selectedExecution=()=>$('#code-language').value!=='python'?'docker':$('#execution-backend').value;
function syncExecution(){
  $('#code-language').disabled=busy||planBusy||confirmingPlan||historyBusy;
  const selected=selectedExecution(),provider=health?.runners?.[selected] || (selected==='docker'?health?.runner:null);
  $('#execution-backend').disabled=busy || hintBusy || mentorBusy || planBusy || confirmingPlan || historyBusy;
  $('#execution-choice-note').textContent=selected==='modal'?t("Modal selected: the submitted code and tests go to Modal. A new CPU Sandbox uses Modal credits; outbound network is blocked and lifetime is capped at 30s after startup. Cold starts can take longer. No automatic Docker fallback."):t("Local Docker selected: execution stays on this computer. Viewing history or reports does not start a cloud job.");
  $('#execution-provider-status').textContent=(provider?.message?t(provider.message):null) || t("Configuration has not been checked yet.");
  if(provider){$('#runner-title').textContent=selected==='modal'?t("Modal cloud configuration"):t("Local Docker environment");$('#runner-message').textContent=t(provider.message);$('.environment-bar').classList.toggle('ready',provider.ready);}
  renderShrink();
  renderRequirements();
  renderMutations();
  interviewUI?.sync();
}

function renderMutations(){
  const report=evidence?.mutationCheck,locked=busy || planBusy || confirmingPlan || hintBusy || mentorBusy || historyBusy;
  const passing=evidence?.results?.length && evidence.passed===evidence.total && evidence.results.every(row=>row.status==='passed');
  $('#check-mutations').disabled=locked || !passing || stale() || (!report && !health?.runners?.docker?.ready);
  $('#check-mutations').textContent=mutationBusy?t("Checking isolated variants…"):report?t("Reopen saved test check"):t("Check my tests");
  $('#mutation-status').textContent=!evidence?t("Complete a passing run first."):stale()?t("Editor changed. Rerun this version before checking its tests."):!passing?t("Resolve the current failing cases first."):report?t("Saved evidence below. Reopening starts no execution."):!health?.runners?.docker?.ready?t("Start local Docker to check your tests."):t("Ready for a bounded local check. No model request or cloud job.");
  const target=$('#mutation-results');if(!report){target.replaceChildren();return;}
  const parts=[node('h3','',report.status==='baseline_changed'?t("Original passing result did not reproduce"):report.status==='no_supported_mutations'?t("No supported comparisons found"):t("What your tests noticed")),node('p','',report.note || ''),node('p','mutation-provenance',t("Source run {0} · {1} · Local Docker · Saved evidence{2}", report.sourceRunId, formatDateTime(report.createdAt), stale()?' · Previous submission; editor has changed.':''))];
  const totals=node('div','requirement-totals');
  for(const [status,label] of [['detected',t("Detected output changes")],['survived',t("Still passed")],['execution_error',t("Raised errors")],['inconclusive','Inconclusive'],['not_run',t("Not run")]]){const count=report.variants.filter(item=>item.status===status).length;if(count)totals.append(node('span','',`${count} ${label}`));}parts.push(totals);
  const labels={detected:t("Detected by your tests"),survived:t("Still passed · Review this gap"),execution_error:t("Variant raised an error"),inconclusive:t("No execution conclusion"),not_run:t("Not run · Budget reached")};
  if(report.baseline)parts.push(node('p','',t("Original replay: {0}/{1} supplied cases passed.", report.baseline.results.filter(row=>row.status==='passed').length, report.baseline.results.length)));
  if(report.status==='baseline_changed')for(const row of report.baseline.results.filter(item=>item.status!=='passed'))parts.push(node('p','mutation-observation',t("Original Test {0} · Expected {1} · {2}", row.index+1, outputLabel(row.expected), row.status==='error'?row.error:`Actual ${outputLabel(row.actual)} · ${row.status}`)));
  for(const variant of report.variants){
    const card=node('article',`mutation-card ${variant.status}`),top=node('div','requirement-card-top');top.append(node('h3','',t("Line {0}: {1} → {2}", variant.line, variant.before, variant.after)),node('span','requirement-state',labels[variant.status]));card.append(top);
    if(variant.status==='survived')card.append(node('p','',t("Every supplied case still passed this changed condition. Review which inputs exercise it; this alone does not prove a missing test or equivalent behavior.")));
    if(variant.reason)card.append(node('p','',variant.reason));
    const source=node('details');source.append(node('summary','',t("Inspect the isolated source change")),node('pre','',codeDiff(latestSubmission().code,variant.code).map(line=>`${line.kind==='added'?'+':line.kind==='removed'?'-':' '} ${line.text}`).join('\n')));card.append(source);
    if(variant.results){
      const observations=node('details');observations.open=variant.status==='detected' || variant.status==='execution_error';observations.append(node('summary','',t("Observed results · {0}/{1} passed", variant.results.filter(row=>row.status==='passed').length, variant.results.length)));
      [...variant.results].sort((a,b)=>Number(a.status==='passed')-Number(b.status==='passed')).forEach(row=>{const item=latestSubmission().cases[row.index];observations.append(node('p','mutation-observation',t("Test {0} · {1} · Expected {2} · {3}", row.index+1, callLabel(latestSubmission(),item), outputLabel(item.expected), row.status==='error'?`Observed error: ${row.error}`:`Actual ${outputLabel(row.actual)} · ${row.status}`)));});card.append(observations);
    }parts.push(card);
  }
  parts.push(node('small','',report.limitations));target.replaceChildren(...parts);
}

async function checkMyTests(){
  if($('#check-mutations').disabled)return;
  const runId=evidence.id;busy=true;mutationBusy=true;$('#run-button').disabled=true;syncAgent();syncExecution();renderSecurity();
  try{const report=await api('/api/mutations/check',{runId,execution:'docker'});if(evidence?.id===runId)evidence.mutationCheck=report;toast(report.cached?t("Saved mutation evidence reopened. No new execution."):t("Test check saved. Inspect detected changes and surviving variants."));}
  catch(error){toast(error.message,true);}
  finally{busy=false;mutationBusy=false;$('#run-button').disabled=false;editorChanged();}
}

function renderRequirements(){
  const map=evidence?.requirementMap,locked=busy || planBusy || confirmingPlan || hintBusy || mentorBusy || historyBusy;
  const button=$('#generate-requirements');
  button.disabled=locked || !evidence || stale() || !latestSubmission().intent?.trim() || (!map && !health?.ai.ready);
  button.textContent=requirementPhase==='planning'?t("Proposing requirements…"):map?t("Reopen saved map · No new model call"):t("Generate requirement proposals ↗");
  $('#requirements-status').textContent=!evidence?t("Complete a verification run with intended behavior first."):stale()?t("Editor changed. This map describes the last completed run; rerun to assess your changes."):map?t("Saved mapping below. Status comes from linked test results, after your explicit review."):!health?.ai.ready?t("Configure AI to propose requirements."):t("Ready for one optional model request. No tests will be generated or executed.");
  const target=$('#requirements-map');if(!map){target.replaceChildren();requirementDraft=null;return;}
  const submission=latestSubmission(),rows=requirementCoverage(map,submission,evidence),draftKey=`${evidence.id}:${map.id}:${map.reviewedAt || ''}`;
  if(requirementDraft?.key!==draftKey)requirementDraft={key:draftKey,reviews:Object.fromEntries(map.requirements.filter(item=>item.kind==='stated').map(item=>{const saved=map.reviews.find(review=>review.requirementId===item.id);return [item.id,{confirmed:Boolean(saved),indices:submission.cases.map((test,index)=>({key:caseKey(test),index})).filter(test=>saved?.caseKeys.includes(test.key)).map(test=>test.index)}];}))};
  const parts=[node('p','requirements-provenance',t("{0} · {1} · {2} original reported tokens · Source {3} · Saved proposals; viewing makes no model call.", map.provider, map.model, map.usage.total_tokens ?? 'Unknown', map.sourceRunId))];
  const totals=node('div','requirement-totals');
  for(const [status,label] of [['supported_examples',t("With supporting examples")],['needs_attention',t("With linked failures")],['no_evidence',t("Without linked evidence")],['missing_evidence',t("With missing cases")],['awaiting_review',t("Awaiting review")],['needs_clarification',t("Need clarification")]]){const count=rows.filter(row=>row.status===status).length;if(count)totals.append(node('span','',`${count} ${label}`));}
  parts.push(totals);
  for(const row of rows){
    const card=node('article',`requirement-card ${row.status}`),top=node('div','requirement-card-top');
    top.append(node('h3','',row.statement),node('span','requirement-state',requirementLabels[row.status]));card.append(top,node('p','requirement-quote',t("Intent excerpt: “{0}”", row.sourceQuote)));
    if(row.kind==='question'){card.append(node('p','',t("Clarify this in your intent, run verification, and generate a new map. A question cannot be confirmed as a stated rule.")));}
    else {
      const choice=requirementDraft.reviews[row.id],label=node('label','requirement-choice'),confirm=node('input');confirm.type='checkbox';confirm.checked=choice.confirmed;confirm.disabled=locked || stale();confirm.setAttribute('aria-label',t("Confirm requirement: {0}", row.statement));confirm.addEventListener('change',()=>{choice.confirmed=confirm.checked;});label.append(confirm,document.createTextNode(' This statement matches my intended behavior.'));card.append(label);
      const cases=node('details','requirement-case-picker');cases.append(node('summary','',t("Choose relevant tests · Links require your review")));
      submission.cases.forEach((item,index)=>{
        const link=node('label','requirement-choice'),check=node('input');check.type='checkbox';check.checked=choice.indices.includes(index);check.disabled=locked || stale();check.setAttribute('aria-label',t("Link test {0} to requirement {1}", index+1, row.id));
        check.addEventListener('change',()=>{choice.indices=check.checked?[...choice.indices,index]:choice.indices.filter(value=>value!==index);});
        const text=node('span','',t("Test {0} · {1} · Expected {2}{3}", index+1, callLabel(submission,item), outputLabel(item.expected), row.suggestedCaseKeys.includes(caseKey(item))?' · AI-suggested relevance, not confirmed':''));link.append(check,text);cases.append(link);
      });card.append(cases);
      if(row.reviewed){card.append(node('p','',t("{0} confirmed link(s). This is a human-reviewed relevance mapping, not an independent check of the requirement or test oracle.", row.links.length)));
        row.links.forEach(link=>{if(!link.result){card.append(node('p','',t("A saved input/expectation is absent from this run. Review the current tests; no evidence is transferred to an edited expected value.")));return;}const observed=node('div','requirement-observed');observed.append(node('p','',t("Test {0} · {1} · Expected {2} · {3}", link.index+1, callLabel(submission,link.item), outputLabel(link.item.expected), link.result.status==='error'?`Observed error: ${link.result.error}`:`Actual ${outputLabel(link.result.actual)} · ${link.result.status}`)));const trace=node('button','text-button',t("Inspect Test {0} execution →", link.index+1));trace.addEventListener('click',()=>openTrace(link.index));observed.append(trace);card.append(observed);});
      }
    }
    parts.push(card);
  }
  if(map.requirements.some(row=>row.kind==='stated')){
    const save=node('button','primary-button',requirementPhase==='saving'?t("Saving review…"):t("Save my requirement review"));save.disabled=locked || stale();
    save.addEventListener('click',saveRequirementReview);parts.push(save,node('p','', t("Review choices take effect only after saving. Unchecked statements remain unconfirmed. You may confirm a requirement without linking a test to record an evidence gap.")));
  }
  parts.push(node('small','', t("This is a map of selected requirements and supplied examples. It cannot detect every missing requirement, establish exhaustive input coverage, or prove correctness. A linked error requires investigation; it does not prove the requirement itself is wrong.")));
  target.replaceChildren(...parts);
}

async function generateRequirements(){
  if($('#generate-requirements').disabled)return;
  const runId=evidence.id;planBusy=true;requirementPhase='planning';syncAgent();syncExecution();
  try{const map=await api('/api/requirements/plan',{runId});if(evidence?.id===runId)evidence.requirementMap=map;toast(map.cached?t("Saved requirement map reopened. No new model call."):t("Requirement proposals ready. Review statements and test relevance before saving."));}
  catch(error){toast(error.message,true);}
  finally{planBusy=false;requirementPhase=null;editorChanged();}
}
async function saveRequirementReview(){
  if(busy || planBusy || confirmingPlan || hintBusy || mentorBusy || historyBusy || stale() || !evidence?.requirementMap)return;
  const runId=evidence.id,mapId=evidence.requirementMap.id,reviews=Object.entries(requirementDraft.reviews).filter(([,review])=>review.confirmed).map(([requirementId,review])=>({requirementId,confirmed:true,caseIndices:review.indices}));
  confirmingPlan=true;requirementPhase='saving';syncAgent();syncExecution();
  try{const map=await api('/api/requirements/confirm',{runId,mapId,reviews});if(evidence?.id===runId){evidence.requirementMap=map;requirementDraft=null;}toast(t("Requirement review saved. Status reflects existing execution evidence; no code or model was run."));}
  catch(error){toast(error.message,true);}
  finally{confirmingPlan=false;requirementPhase=null;editorChanged();}
}

function renderShrink(){
  const select=$('#shrink-case'),previous=select.value;
  const submission=evidence?latestSubmission():null;
  const eligible=(evidence?.results || []).filter(row=>['failed','error'].includes(row.status) && shrinkableCase(submission.cases[row.index]));
  select.replaceChildren(...(eligible.length?eligible.map(row=>{const option=node('option','',t("Test {0} · {1}", row.index+1, callLabel(submission,submission.cases[row.index])));option.value=String(row.index);return option;}):[node('option','',t("No supported failing list test"))]));
  if(eligible.some(row=>String(row.index)===previous))select.value=previous;
  const locked=busy || planBusy || confirmingPlan || hintBusy || mentorBusy || historyBusy;
  select.disabled=locked || !eligible.length;
  $('#shrink-contract').disabled=locked;$('#confirm-shrink-contract').disabled=locked;
  let contract=$('#shrink-contract').value;
  if(!contract){const saved=Object.values(evidence?.shrinks || {}).find(report=>report.caseIndex===Number(select.value));if(saved && Object.hasOwn(shrinkContracts,saved.contract)){$('#shrink-contract').value=saved.contract;contract=saved.contract;}}
  const confirmed=$('#confirm-shrink-contract').checked;
  $('#shrink-button').disabled=locked || !eligible.length || stale() || !contract || !confirmed || !health?.runners?.docker?.ready;
  $('#shrink-button').textContent=busy?t("Execution in progress…"):t("Find a smaller failing input");
  $('#shrink-status').textContent=!eligible.length?t("Requires a failing test with one list argument, at most 32 integers (±1,000,000), and no keyword arguments."):stale()?t("Editor changed. Rerun or reopen the saved run before shrinking."):!health?.runners?.docker?.ready?t("Start local Docker to shrink this case."):!contract || !confirmed?t("Select and confirm the rule before executing candidate inputs."):t("Ready to search locally. Original tests remain unchanged.");
  const report=evidence?.shrinks?.[JSON.stringify([Number(select.value),contract,'deletion-v1'])],target=$('#shrink-result');
  if(!report){target.replaceChildren();return;}
  const parts=[node('h3','',report.status==='reduced'?t("A smaller failure, reproduced"):report.status==='unstable'?t("Observation did not reproduce"):t("No smaller counterexample established")),node('p','',report.message),node('p','',t("{0} · {1} executed case(s) · Saved with source run. Reopening does not execute code.", report.contractText, report.attempts.length))];
  const comparison=node('div','shrink-comparison');
  for(const [label,item] of [['ORIGINAL',report.original],...(report.reduced?[[t("SMALLER · REPLAYED"),report.reduced]]:[])]){
    const card=node('article','shrink-case');card.append(node('strong','',t("{0} · {1} items", label, item.input.length)),node('pre','',`${submission.functionName}(${JSON.stringify(item.input)})`),node('p','',t("Expected: {0}", outputLabel(item.expected))),node('p','',item.status==='error'?t("Observed error: {0}", item.error):t("Actual: {0} · {1}", outputLabel(item.actual), item.status)));comparison.append(card);
  }
  parts.push(comparison,node('p','',report.minimality));
  const attempts=node('details');attempts.append(node('summary','',t("Inspect every executed candidate and replay")));
  report.attempts.forEach((item,index)=>attempts.append(node('pre','',t("{0}. {1} → Expected {2} · {3}", index+1, JSON.stringify(item.input), outputLabel(item.expected), item.status==='error'?item.error:`Actual ${outputLabel(item.actual)} · ${item.status}`))));
  parts.push(attempts);
  if(report.reduced){
    const item={args:[report.reduced.input],expected:report.reduced.expected};
    const duplicate=submission.cases.some(existing=>caseKey(existing)===caseKey(item));
    const label=node('label','shrink-confirm'),review=node('input');review.type='checkbox';label.append(review,document.createTextNode(' I reviewed this smaller input and its expected value.'));
    const add=node('button','secondary-button',duplicate?t("Smaller case already in suite"):t("Add reviewed case to my tests"));add.disabled=true;
    review.disabled=locked || stale() || duplicate || submission.cases.length>=20;
    review.addEventListener('change',()=>{add.disabled=!review.checked || locked || stale();});
    add.addEventListener('click',()=>{if(busy || stale() || !review.checked)return;const currentSubmission=current();if(currentSubmission.cases.length>=20)return;$('#cases').value=JSON.stringify([...currentSubmission.cases,item],null,2);replaySuite=null;reviewedPlan=null;agentPlan=null;baseline=structuredClone(currentRecord());renderAgentPlan();editorChanged();toast(t("Reviewed case added. Run verification to collect evidence for the expanded suite."));});
    parts.push(label,add);
  }
  target.replaceChildren(...parts);
}

async function shrinkFailure(){
  if($('#shrink-button').disabled || !evidence || stale())return;
  const sourceId=evidence.id,caseIndex=Number($('#shrink-case').value),contract=$('#shrink-contract').value;
  busy=true;$('#run-button').disabled=true;syncAgent();syncExecution();renderSecurity();
  try{
    const report=await api('/api/shrink',{runId:sourceId,caseIndex,contract,confirmContract:$('#confirm-shrink-contract').checked,execution:'docker'});
    if(evidence?.id===sourceId){evidence.shrinks ||= {};evidence.shrinks[JSON.stringify([caseIndex,contract,'deletion-v1'])]=report;}
    toast(report.cached?t("Saved shrinking evidence reopened. No new execution."):report.message);
  }catch(error){toast(error.message,true);}
  finally{busy=false;$('#run-button').disabled=false;editorChanged();}
}

async function previewRegression(id) {
  if(busy || hintBusy || mentorBusy || planBusy || confirmingPlan || historyBusy)return;
  try {
    const source=await api(`/api/history/${id}`);regressionPreview=source;
    const target=$('#regression-preview');target.replaceChildren(node('h3','',source.submission.functionName),node('p','',source.submission.intent || t("No intent recorded.")),node('p','',t("Baseline: {0}/{1} passed · {2}", source.evidence.passed, source.evidence.total, source.evidence.createdAt)));
    source.submission.cases.forEach((item,index)=>target.append(node('pre','',t("TEST {0} · {1} → Expected {2}", index+1, callLabel(source.submission,item), outputLabel(item.expected)))));
    $('#confirm-regression').checked=false;$('#load-regression').disabled=true;$('#regression-dialog').showModal();
  }catch(error){toast(error.message,true);}
}

function renderRegression() {
  const target=$('#regression-guard');target.hidden=!replaySuite;
  if(!replaySuite){target.replaceChildren();return;}
  let matches=false;try{matches=matchesRegression(current(),replaySuite);}catch{}
  const parts=[node('h3','',matches?t("Regression Guard · Original suite selected"):t("Regression Guard paused · Contract or tests changed")),node('p','',t("{0} saved cases · Baseline {1}/{2} passed. Edit your code; keep the function, intent and test expectations unchanged. Guarded results are calculated by Python, without new AI planning.", replaySuite.submission.cases.length, replaySuite.evidence.passed, replaySuite.evidence.total))];
  if(evidence?.regression?.sourceRunId===replaySuite.evidence.id && !stale()){const result=evidence.regression;parts.push(node('p',result.regressed?'guard-regressed':'guard-result',t("Observed guard result: {0} fixed · {1} regressed · {2} unresolved · {3}/{4} passed.", result.fixed, result.regressed, result.unresolved, evidence.passed, evidence.total)));}
  const run=node('button','primary-button',t("Run saved regression suite"));run.disabled=!matches || busy || mentorBusy || hintBusy || planBusy || confirmingPlan;run.addEventListener('click',()=>runVerification());
  const release=node('button','text-button',t("Release guard · Use editable tests"));release.disabled=busy;release.addEventListener('click',()=>{replaySuite=null;renderRegression();toast(t("Guard released. Edited cases will run as supplied tests."));});
  parts.push(run,release);target.replaceChildren(...parts);
}

function renderSecurity() {
  $('#review-security').disabled=busy || mentorBusy || hintBusy || planBusy || confirmingPlan || historyBusy;
  const target=$('#security-content');
  const saved=evidence?.security ? {code:latestSubmission().code,report:evidence.security,savedWithRun:evidence.id} : null;
  const selected=securityPreview || saved;
  if(!selected){target.replaceChildren(node('p','',t("No saved static review for this source. Run a review or full verification.")));return;}
  const {report}=selected;
  const changed=selected.code!==$('#code').value;
  const status=node('p','security-status',`${changed ? t("SOURCE CHANGED · Review again. Results below describe earlier source. ") : ''}${selected.savedWithRun ? t("Saved with verification history.") : t("Preview only · Not yet saved with a verification run.")}`);
  const parts=[status];
  if(report.status!=='completed')parts.push(node('h3','',t("Static review not completed")),node('p','',t(report.reason) || t("The scanner was unavailable.")),node('p','',report.errorLine ? t("Syntax error at line {0}. Fix it and review again.", report.errorLine) : t("No security conclusion is available.")));
  else {
    parts.push(node('h3','',report.findings.length ? t("{0} static warning(s) to review", report.findings.length) : t("No warnings in the checked rule families")),node('p','',t("{0} v{1} · {2} rule families · {3}Exploitability not verified{4}", report.engine, report.version, report.rulesChecked.length, report.execution==='modal-python'?'Modal cloud review · ':report.execution==='docker-python'?'Local Docker review · ':'', report.truncated ? ' · Finding limit reached; report is incomplete' : '')));
    for(const finding of report.findings){
      const card=node('article','security-finding');card.append(node('h3','',t("{0} · Line {1}:{2} · {3}", finding.ruleId, finding.line, finding.column, t(finding.title))),node('pre','',finding.snippet),node('p','',t(finding.reason)),node('strong','',t("Review / mitigation")),node('p','',t(finding.guidance)));
      const reference=node('a','',t("Python documentation ↗"));reference.href=finding.reference;reference.target='_blank';reference.rel='noopener noreferrer';card.append(reference);parts.push(card);
    }
    parts.push(node('p','security-limit',t(report.limitations)));
  }
  const jump=node('button','text-button',t("Inspect source code →"));jump.addEventListener('click',()=>{ $('#code').scrollIntoView({block:'center'});$('#code').focus({preventScroll:true}); });parts.push(jump);target.replaceChildren(...parts);
}

async function reviewCurrentSecurity() {
  if(busy || hintBusy || mentorBusy || planBusy || confirmingPlan)return;
  const code=$('#code').value,runId=evidence && code===latestSubmission().code ? evidence.id : null;
  busy=true;$('#run-button').disabled=true;renderSecurity();syncExecution();
  try { const result=await api('/api/security/review',{code,execution:selectedExecution(),...(runId?{runId}:{})});securityPreview=result;if(evidence?.id===runId)evidence.security=result.report;toast(t("Static review complete. Submitted source was not executed.")); }
  catch(error){toast(error.message,true);}
  finally{busy=false;$('#run-button').disabled=false;editorChanged();}
}

async function refreshMemory() {
  const target = $('#memory-content');
  try {
    const memory = await api('/api/learning-memory');
    const stats = node('div','memory-stats');
    for (const [value,label] of [[memory.personalAttempts,t("Personal attempts")],[memory.matchingPredictions,t("Predicted actual output")],[memory.explanationsSaved,t("Explanations saved")]]) { const stat=node('div');stat.append(node('strong','',value),node('span','',label));stats.append(stat); }
    const message = node('p','',memory.personalAttempts ? t("{0} predictions differed from execution; {1} executions raised an error. These are practice observations, not grades.", memory.differingPredictions, memory.executionErrors) : t("No personal practice recorded yet. Before your next prediction, select “Include this next run in my personal practice log.” Demonstrations stay separate."));
    const parts=[stats,message,node('p','memory-note',t(memory.note))];
    if (memory.revisit.length) parts.push(node('p','',t("Worth revisiting: {0}. Compare the implementation’s behavior with the requirement, then try a new context below.", memory.revisit.join('; '))));
    for (const item of memory.observations.slice(0,5)) {
      const card=node('article','memory-observation');
      card.append(node('strong','',item.concept),node('p','',`${item.functionName} · ${item.predictionMatched===null ? t("Execution error; no return-value comparison") : item.predictionMatched ? t("Prediction matched execution") : t("Prediction differed from execution")} · ${item.explanationSaved ? t("Explanation saved") : t("No explanation yet")}`));
      const open=node('button','text-button',t("Revisit this evidence →"));open.addEventListener('click',()=>openSavedRun(item.runId));card.append(open);parts.push(card);
    }
    target.replaceChildren(...parts);
  } catch(error) { target.replaceChildren(node('p','',t("Learning memory unavailable: {0}", error.message))); }
}

function renderTransferPractices() {
  const cards=transferPractices.map(practice=>{
    const card=node('article','transfer-card');card.append(node('h3','',t(practice.title)),node('p','',practice.intent),node('small','',t("{0} · Curated exercise · No AI call · Loading replaces your draft.", t(practice.concept))));
    const preview=node('details');preview.append(node('summary','',t("Review the supplied test expectations")));
    for(const item of practice.cases)preview.append(node('pre','',`${callLabel(practice,item)} → ${outputLabel(item.expected)}`));card.append(preview);
    const label=node('label','contract-confirm'),check=node('input');check.type='checkbox';label.append(check,node('span','',t("I reviewed these expected values.")));
    const load=node('button','secondary-button',t("Load this transfer practice"));load.disabled=true;
    check.addEventListener('change',()=>{load.disabled=!check.checked;});
    load.addEventListener('click',()=>{
      if(!check.checked || busy || hintBusy || mentorBusy || planBusy || confirmingPlan || historyBusy)return;
      $('#new-task').click();selectedPracticeId=practice.id;
      $('#code').value=practice.code;$('#intent').value=practice.intent;$('#function-name').value=practice.functionName;$('#cases').value=JSON.stringify(practice.cases,null,2);
      editorChanged();revealWorkspace('code-heading');$('#code-heading').scrollIntoView({block:'start'});toast(t("Practice loaded. Make your own prediction before running; no AI call was made."));
    });card.append(label,load);return card;
  });$('#transfer-practices').replaceChildren(...cards);
}

function renderLearning() {
  const target = $('#learning-content'), disabled = busy || hintBusy || planBusy || confirmingPlan || mentorBusy;
  let submission; try { submission = current(); } catch { submission = null; }
  const predictionSection = node('section', 'learning-stage');
  predictionSection.append(node('h3', '', t("1. Predict before your next run")), node('p', '', t("Choose a test and predict the implementation’s return value as JSON, e.g. true, 0, or \"hello\". Normal verification also works without a prediction.")));
  if (Array.isArray(submission?.cases) && submission.cases.length && submission.cases.every(item=>item && Array.isArray(item.args) && Object.hasOwn(item,'expected'))) {
    const selectLabel = node('label', 'case-input-label', t("Test to predict")), select = node('select'); select.id = 'prediction-case';
    submission.cases.forEach((item,index) => { const option = node('option', '', t("Test {0} · {1}", index + 1, callLabel(submission,item))); option.value = index; select.append(option); });
    learnerDraft.caseIndex = Math.min(Math.max(0, learnerDraft.caseIndex), submission.cases.length - 1); select.value = learnerDraft.caseIndex;
    select.disabled = disabled; select.addEventListener('change', () => { learnerDraft.caseIndex = Number(select.value); saveDraft(); }); selectLabel.append(select);
    const valueLabel = node('label', 'case-input-label', t("My predicted return value · JSON")), value = node('textarea', 'case-value-input'); value.id = 'prediction-value'; value.rows = 2; value.value = learnerDraft.predictionText; value.disabled = disabled;
    value.addEventListener('input', () => { learnerDraft.predictionText = value.value; saveDraft(); }); valueLabel.append(value);
    const run = node('button', 'primary-button', t("Lock prediction & run tests")); run.disabled = disabled;
    run.addEventListener('click', () => { try { if (!learnerDraft.predictionText.trim()) throw Error(); const value = JSON.parse(learnerDraft.predictionText); if (JSON.stringify(value).length > 4000) throw Error(); runVerification({ prediction: { caseIndex: learnerDraft.caseIndex, value, personalPractice:learnerDraft.personalPractice===true, practiceId:selectedPracticeId } }); } catch { toast(t("Enter a valid JSON prediction of at most 4,000 characters."), true); } });
    const participation=node('label','contract-confirm'),personal=node('input');personal.type='checkbox';personal.id='personal-practice';personal.checked=learnerDraft.personalPractice===true;personal.disabled=disabled;
    personal.addEventListener('change',()=>{learnerDraft.personalPractice=personal.checked;saveDraft();});participation.append(personal,node('span','',t("Include this next run in my personal practice log.")));
    predictionSection.append(selectLabel, valueLabel, participation, node('small','',t("Leave unchecked for a demonstration. Only explicitly included attempts enter Learning Memory.")), run);
  } else predictionSection.append(node('p', '', t("Add or confirm at least one test to begin.")));
  const parts = [predictionSection];
  if (evidence) {
    const observed = node('section', 'learning-stage');
    observed.append(node('h3', '', t("2. Compare your prediction with the evidence")));
    if (!learning.prediction) observed.append(node('p', '', t("No prediction was captured before this run. Make a prediction above and run again to start this learning loop.")));
    else {
      const index = learning.prediction.caseIndex, test = latestSubmission().cases[index], result = evidence.results[index];
      observed.append(node('pre', '', callLabel(latestSubmission(),test)));
      const values = node('div', 'learning-comparison');
      for (const [title,text] of [[t("YOUR PREDICTION"),outputLabel(learning.prediction.value)],[t("PYTHON OBSERVED"),result.status === 'error' ? result.error : outputLabel(result.actual)],[t("TEST EXPECTATION"),outputLabel(test.expected)]]) { const item=node('div'); item.append(node('small','',title),node('pre','',text)); values.append(item); }
      observed.append(values, node('p', '', result.status === 'error' ? t("Python raised an error. The prediction was a return value, not an error prediction.") : canonical(learning.prediction.value) === canonical(result.actual) ? t("Your prediction matched this execution. That does not establish that the implementation meets the requirement.") : t("Your prediction differed from this execution. Which part of the code explains the difference?")));
      observed.append(node('small','', t("Prediction submitted before this run · {0}{1}", formatDateTime(learning.prediction.capturedAt), stale() ? ' · Editor changed; this discussion belongs to the saved run.' : '')));
      observed.append(node('small','',learning.prediction.participation==='personal' ? t("Included in personal practice · Self-selected, not a skill assessment") : t("Demonstration or unclassified practice · Excluded from personal Learning Memory")));
      const label = node('label','case-input-label',t("3. Explain your reasoning")), answer = node('textarea','case-value-input'); answer.id='learner-answer'; answer.rows=4; answer.maxLength=4000; answer.value=learnerDraft.answerRunId===evidence.id ? learnerDraft.answer : learning.answer || ''; answer.disabled=disabled;
      answer.addEventListener('input', () => { learnerDraft.answer=answer.value; learnerDraft.answerRunId=evidence.id; saveDraft(); const notice=$('#reflection-status'); if (notice) notice.textContent=t("Draft changed · Save your explanation before requesting feedback."); const button=$('#reflection-feedback'); if (button) button.disabled=true; const prior=$('#reflection-result'); if (prior) prior.hidden=true; }); label.append(answer);
      const save=node('button','secondary-button',t("Save my explanation · No API use")); save.disabled=disabled; save.addEventListener('click',saveExplanation);
      const feedback=node('button','primary-button',mentorBusy ? t("Working…") : t("Ask AI to reflect on my reasoning")); feedback.id='reflection-feedback'; feedback.disabled=disabled || !health?.ai.ready || !learning.answer || answer.value.trim()!==learning.answer;
      feedback.addEventListener('click',requestReflection);
      const status=node('p','',t("Saved explanations and feedback stay with this run.")); status.id='reflection-status';
      observed.append(label,save,status,feedback,node('p','learning-disclosure',t("Optional: sends this run’s code, selected test, observed result, prediction and explanation to {0}. Uses API credits when clicked. Identical saved feedback is reused.", health?.ai.model || 'your configured provider')));
      const saved=Object.values(learning.feedback || {}).filter(item=>item.answer===learning.answer&&matchesHintLanguage(item)).at(-1);
      if (saved && answer.value.trim()===learning.answer) { const section=node('section','reflection-result'); section.id='reflection-result'; section.append(node('h3','',t("4. AI reflection · Not verified")),node('p','',saved.text),node('small','',t("{0} · {1} total tokens · Saved feedback · No new execution", saved.model, saved.totalTokens ?? 'Unknown'))); observed.append(section); }
    }
    parts.push(observed);
  }
  target.replaceChildren(...parts);
}

async function saveExplanation() {
  if (mentorBusy || busy || !evidence) return;
  const runId=evidence.id, answer=learnerDraft.answerRunId===runId ? learnerDraft.answer : learning.answer;
  mentorBusy=true; renderLearning();
  try { const result=await api('/api/mentor/answer',{runId,answer}); if (evidence?.id===runId) { learning=result; learnerDraft.answer=result.answer; learnerDraft.answerRunId=runId; saveDraft(); toast(t("Explanation saved. No model call was made.")); } } catch(error) { toast(error.message,true); }
  finally { mentorBusy=false; renderLearning(); await refreshMemory(); }
}
async function requestReflection() {
  if (mentorBusy || busy || !evidence || !learning.answer) return;
  const runId=evidence.id, answer=learning.answer; mentorBusy=true; renderLearning();
  try { const result=await api('/api/mentor/feedback',{runId,language:hintLanguage}); if (evidence?.id===runId && learning.answer===answer) { learning.feedback={...learning.feedback,[result.createdAt]:result}; toast(result.cached ? t("Saved feedback reused. No new model call.") : t("AI reflection saved. Rerun tests to verify any changes.")); } } catch(error) { toast(error.message,true); }
  finally { mentorBusy=false; renderLearning(); await refreshMemory(); }
}

async function saveWorkspace() {
  verificationTasks?.changed();
  try {
    await api('/api/history/workspace', { activeRunId: evidence?.id || null, baselineRunId: baseline?.evidence.id || null });
    $('#history-status').textContent = t("Workspace saved · Reopen this page to continue.");
  } catch (error) { $('#history-status').textContent = t("Workspace not saved: {0}", error.message); toast(t("Could not save the comparison selection. Your completed runs are still in history."), true); }
}

async function refreshHistory(restore = false) {
  try {
    const data = await api('/api/history');
    const cards = data.runs.map(run => {
      const card = node('article', 'history-card');
      card.append(node('strong', '', run.functionName), node('p', '', t("{0}/{1} passed · {2} · {3} · {4} saved hints", run.passed, run.total, formatDateTime(run.createdAt), run.execution==='modal-python'?'Modal cloud CPU':run.execution==='docker-python'?'Local Docker':'Environment not recorded', run.hintCount)));
      const open = node('button', 'secondary-button', evidence?.id === run.id ? t("Reopen this saved run") : t("Open saved run")); open.disabled = busy || hintBusy || planBusy || confirmingPlan || historyBusy;
      open.addEventListener('click', () => openSavedRun(run.id));
      const reuse=node('button','text-button',t("Reuse tests with my code"));reuse.disabled=open.disabled;reuse.addEventListener('click',()=>previewRegression(run.id));card.append(open,reuse); return card;
    });
    $('#history-list').replaceChildren(...cards);
    $('#history-status').textContent = data.runs.length ? t("{0} recent saved runs · Code and results stay on this computer.", data.runs.length) : t("No saved runs yet. Your next verification will be saved automatically.");
    if (restore && data.workspace.activeRunId && !busy && !planBusy) await openSavedRun(data.workspace.activeRunId, true, data.workspace.baselineRunId);
    await refreshMemory();
  } catch (error) { $('#history-status').textContent = t("History unavailable: {0}", error.message); }
}

async function openSavedRun(id, automatic = false, selectedBaseline) {
  $('#lesson-import-note').hidden=true;
  if (busy || hintBusy || planBusy || confirmingPlan || historyBusy || mentorBusy) return;
  if(!automatic)verificationTasks?.reset();
  const snapshot = currentSnapshot(); historyBusy = true; busy = true;
  $('#run-button').disabled = true;
  syncHint(); syncAgent(); syncChallenge(); renderRepairJourney();
  try {
    const record = await api(`/api/history/${id}`);
    const baselineId = selectedBaseline === undefined ? record.baselineRunId : selectedBaseline;
    const savedBaseline = baselineId ? await api(`/api/history/${baselineId}`) : null;
    const savedReplay=record.evidence.regression ? await api(`/api/history/${record.evidence.regression.sourceRunId}`) : null;
    if (automatic && currentSnapshot() !== snapshot) return;
    if (!automatic || !hasDraft) {
      $('#code').value = record.submission.code; $('#intent').value = record.submission.intent || '';
      $('#function-name').value = record.submission.functionName; $('#cases').value = JSON.stringify(record.submission.cases, null, 2);
      selectedExample = null; confirmedContract = null; challengeProvenance = null;
    }
    $('#code-language').value=record.submission.codeLanguage||'python';$('#code').dataset.codeLanguage=$('#code-language').value;queueMicrotask(()=>syncCodeLanguage());
    evidence = record.evidence; runSnapshot = JSON.stringify(record.submission); baseline = savedBaseline; learning=record.mentor || {};
    replaySuite=savedReplay;
    if(!automatic || !hasDraft)selectedPracticeId=learning.prediction?.practiceId || null;
    if (learnerDraft.answerRunId!==evidence.id) { learnerDraft.answer=learning.answer || ''; learnerDraft.answerRunId=evidence.id; }
    hints = {}; hintDetails = {};
    for (const hint of Object.values(record.hints || {}).filter(matchesHintLanguage)) { hints[hint.level] = hint.hint; hintDetails[hint.level] = hint; }
    restoredEvidence = true; runProvenance = null; repairJourney = null; agentPlan = null; planSnapshot = null; reviewedPlan = null; securityPreview=null;
    renderAgentPlan(); displayResults();
    if (!automatic) { await saveWorkspace(); $('#evidence-heading').scrollIntoView({ block: 'start' }); }
  } catch (error) { toast(t("Could not reopen saved evidence: {0}", error.message), true); }
  finally { busy = false; historyBusy = false; $('#run-button').disabled = false; editorChanged(); await refreshHistory(); }
}
const guideText = {
  1: t("When the result differs from your expectation,\nwhich assumption would you check first?"),
  2: t("Compare the failing cases with the passing ones.\nCould an unhandled edge case explain the difference?"),
  3: t("Try the smallest fix, then rerun the same cases.\nAdd another case that would catch the same bug."),
};

function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = content;
  return el;
}

function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').className = `toast${error ? ' error' : ''}`;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 9000 : 4500);
}

document.addEventListener('workspace-view-changed',()=>{clearTimeout(toastTimer);const notice=$('#toast');if(notice)notice.hidden=true;});

function current() {
  return { ...($('#code-language').value!=='python'?{codeLanguage:$('#code-language').value}:{}),code: $('#code').value, functionName: $('#function-name').value.trim(), intent: $('#intent').value.trim(), cases: JSON.parse($('#cases').value) };
}
function currentSnapshot() { try { return JSON.stringify(current()); } catch { return null; } }
function stale() { try { return evidence && canonical(current()) !== canonical(JSON.parse(runSnapshot)); } catch { return Boolean(evidence); } }

function saveDraft() {
  verificationTasks?.changed();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem('invarith-draft-v1', JSON.stringify({ codeLanguage:$('#code-language').value,code: $('#code').value, functionName: $('#function-name').value, intent: $('#intent').value, cases: $('#cases').value, exampleName: selectedExample, confirmedContract, challengeEnabled: Boolean(challengeProvenance), learnerDraft, selectedPracticeId }));
      $('#draft-dot').title = t("Draft saved in this browser");
    } catch { $('#draft-dot').title = t("Draft storage is unavailable in this browser"); }
  }, 300);
}

function editorChanged() {
  document.querySelector('.studio-app')?.classList.toggle('non-python-editor',$('#code-language').value!=='python');
  $('#lesson-import-note h3').textContent=evidence&&!stale()?t('Lesson solution · Evidence collected for supplied cases'):t('Lesson solution · Not verified yet');
  for (const button of document.querySelectorAll('.history-card button')) button.disabled = busy || hintBusy || planBusy || confirmingPlan || historyBusy;
  const count = $('#code').value.split('\n').length;
  $('#line-numbers').textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
  $('#line-count').textContent = t("{0} lines", count);
  try { const cases = JSON.parse($('#cases').value); $('#case-count').textContent = Array.isArray(cases) ? cases.length : '?'; } catch { $('#case-count').textContent = '?'; }
  if (evidence) {
    $('#evidence-badge').textContent = stale() ? t("Edited · Rerun required") : t("{0} / {1} Passed", evidence.passed, evidence.total);
    $('#evidence-badge').className = `neutral-badge ${stale() ? '' : evidence.passed === evidence.total ? 'passed' : 'failed'}`;
  }
  syncHint(); syncChallenge(); syncAgent(); renderComparison(); renderCaseCards(); renderAgentFindings(); renderTrace(); renderRepairJourney(); renderEvidenceNextStep(); renderLearning(); renderSecurity(); renderRegression(); syncExecution(); saveDraft();
}

function renderEvidenceNextStep() {
  const target = $('#evidence-next-step'); target.hidden = !evidence;
  if (!evidence) { target.replaceChildren(); return; }
  let submission; try { submission = current(); } catch { submission = null; }
  const progress = repairProgress(baseline, currentRecord(), submission);
  const copy = {
    edited: [t("Code or tests changed · Run again"), t("The cards below belong to the previous run. Rerun before judging your current changes.")],
    suite_changed: [t("The test suite changed"), t("This is not a comparison of the same tests. Changed expectations cannot establish a repair. Inspect the comparison below.")],
    repaired: [t("Repair verified on the same tests"), 'A previously failing case now passes, all supplied cases pass, and none regressed. Untested behavior remains unverified.'],
    passed: [t("All supplied tests passed"), t("These results cover only the supplied inputs. Export the evidence or add another boundary case.")],
    failing: [t("Next: edit your code, then rerun"), t('{0} Keep the intent and test expectations unchanged while you repair the code.', baseline && sameTask(baseline.submission, latestSubmission()) ? t("A completed run is saved as the comparison baseline.") : t("Use Pin baseline below to save this run for comparison."))],
  };
  if(progress==='suite_changed' && evidence.followUpChallenge){
    const follow=evidence.followUpChallenge;
    copy.suite_changed=[follow.newCaseFailures?t("New cases exposed an untested failure"):t("The added cases passed too"),`${follow.originalCases} original case(s) retained. ${follow.addedCases} reviewed case(s) added: ${follow.newCasePasses} passed, ${follow.newCaseFailures} failed or raised an error. This expands the tested inputs; it does not establish a repair or complete correctness.`];
  }
  const [title, detail] = copy[progress];
  const heading = node('h3', '', title), description = node('p', '', detail);
  const action = node('button', 'primary-button'); action.disabled = busy || planBusy || confirmingPlan;
  if (progress === 'edited') { action.textContent = t("Rerun verification"); action.addEventListener('click', runVerification); }
  else if (progress === 'failing') { action.textContent = t("Edit my code"); action.addEventListener('click', () => { $('#code').scrollIntoView({ block: 'center' }); $('#code').focus({ preventScroll: true }); }); }
  else { action.textContent = progress === 'passed' ? t("Export evidence") : t("See before & after"); action.addEventListener('click', () => progress === 'passed' ? $('#export-button').click() : $('#comparison-heading').scrollIntoView({ block: 'start' })); }
  const parts = [heading, description, action];
  if (progress === 'failing') {
    const mentor = node('button', 'text-button', t("Need a hint? Open mentor")); mentor.addEventListener('click', () => $('#mentor-heading').scrollIntoView({ block: 'start' })); parts.push(mentor);
  }
  target.replaceChildren(...parts);
  const notice = $('#evidence-snapshot-note'); if (notice) notice.textContent = stale() ? t("PREVIOUS RUN · Editor changed. These outputs have not been rerun.") : restoredEvidence ? t("SAVED EVIDENCE · Executed {0}. Reopened without rerunning code.", formatDateTime(evidence.createdAt)) : t("OBSERVED OUTPUTS · Executed by {0}, checked against the supplied expectations.",codeLanguages.find(row=>row.id===(latestSubmission().codeLanguage||'python'))?.label||'Python');
}

function latestSubmission() { return JSON.parse(runSnapshot); }

function renderRepairJourney() {
  const target = $('#repair-content');
  $('#start-repair').disabled = busy || planBusy || confirmingPlan || hintBusy;
  if (!repairJourney) { target.replaceChildren(node('p', '', t("Try the $500 free-delivery boundary. Find a real failure, get a hint, edit the code, and rerun the same three tests. Starting replaces your current draft."))); return; }
  let submission; try { submission = current(); } catch { submission = null; }
  const sameSuite = submission && matchesDeliverySuite(submission);
  const completed = evidence && !stale() && repairOutcome(repairJourney.before, currentRecord());
  const stage = !sameSuite ? 'scope' : !repairJourney.before ? 'run' : completed?.complete ? 'done' : !repairJourney.hintShown ? 'hint' : submission.code === repairJourney.before.submission.code ? 'edit' : 'rerun';
  const copy = {
    scope: [t("Keep the original expectations"), t("The function, intent, or test cases changed. Restart this demo to compare the same three checks.")],
    run: [t('1. Find the failing boundary'), t("The reviewed examples expect 60 at $499, 0 at $500, and 0 at $501. Run Python to see what this implementation returns.")],
    hint: [t('2. Explain the mismatch'), t("Inspect the observed results below, then reveal a question to guide your fix.")],
    edit: [t('3. Make your own repair'), t("Edit the condition in Your code below. Keep the intent and all three expected values unchanged.")],
    rerun: [t('4. Verify your repair'), t("Run the same three cases again. Editing code alone does not prove the bug is fixed.")],
    done: [t("Repair verified on the same 3 tests"), t('{0} failing case(s) now pass; all 3 supplied cases pass. Broader behavior remains unverified.',completed?.fixed||0)],
  };
  const parts = [node('h3', '', copy[stage][0]), node('p', '', copy[stage][1])];
  if (repairJourney.before) {
    const failed = repairJourney.before.evidence.results.findIndex(row => row.status !== 'passed');
    if (failed >= 0) {
      const result = repairJourney.before.evidence.results[failed], item = repairJourney.before.submission.cases[failed];
      parts.push(node('p', 'repair-proof', t("BEFORE · Order ${0} · Expected fee ${1} · {2}", item.args[0], item.expected, result.status === 'error' ? result.error : t('Actual fee ${0}',result.actual))));
      if (stage === 'done') parts.push(node('p', 'repair-proof repaired', t("AFTER · Order ${0} · Expected fee ${1} · Actual fee ${2}", item.args[0], item.expected, evidence.results[failed].actual)));
    }
  }
  if (repairJourney.aiHint && matchesHintLanguage(repairJourney.aiHint)) {
    const hint = repairJourney.aiHint;
    parts.push(node('p', 'agent-warning', hint.hint), node('p', '', t("{0} · AI suggestion for failing run {1} · Not verified · {2}", hint.model, hint.runId.slice(0, 8), hint.cached ? t('Reused saved hint · No new model call') : t('{0} total tokens',hint.usage?.total_tokens??t('Unknown')))));
  } else if (repairJourney.hintShown) parts.push(node('p', 'agent-warning', t("Practice mentor · Prewritten, no AI call: At exactly $500, is “greater than 500” true? Which comparison includes the boundary promised by “500 or more”?")));
  const action = node('button', 'primary-button'); action.disabled = busy || planBusy || confirmingPlan || hintBusy;
  if (stage === 'run' || stage === 'rerun') {
    action.textContent = stage === 'run' ? t("Run the 3 tests") : t("Rerun the same 3 tests"); action.addEventListener('click', runVerification);
  } else if (stage === 'hint') {
    action.textContent = hintBusy ? t("Asking the model…") : t("Ask AI about this failure");
    action.disabled ||= !health?.ai.ready || Boolean(stale());
    action.addEventListener('click', () => requestHint(1));
    const fallback = node('button', 'text-button', t("Use a free practice hint instead")); fallback.disabled = hintBusy || busy;
    fallback.addEventListener('click', () => { repairJourney.hintShown = true; renderRepairJourney(); });
    parts.push(node('p', '', t("Sends this submitted code, intent, tests, and observed results to {0}. Uses API credits only when clicked; saved hints are reused. If you edited the code, rerun first.", health?.ai.model || 'your configured provider')), fallback);
  } else if (stage === 'edit') {
    action.textContent = t("Edit my code"); action.addEventListener('click', () => { $('#code').scrollIntoView({ block: 'center' }); $('#code').focus({ preventScroll: true }); });
  } else if (stage === 'done') {
    action.textContent = t("Inspect before & after"); action.addEventListener('click', () => $('#comparison-heading').scrollIntoView({ block: 'start' }));
  } else action.hidden = true;
  parts.push(action);
  target.replaceChildren(...parts);
}

const reviewScope = submission => canonical({ functionName: submission.functionName, intent: submission.intent || '', cases: submission.cases });
function planStale() { return agentPlan && currentSnapshot() !== planSnapshot; }
function activeReview() { try { return reviewedPlan && reviewScope(current()) === reviewScope(reviewedPlan.submission) ? reviewedPlan : null; } catch { return null; } }

function syncAgent() {
  for (const button of document.querySelectorAll('.history-card button')) button.disabled = busy || hintBusy || planBusy || confirmingPlan || historyBusy;
  $('#generate-plan').disabled = !health?.ai.ready || busy || planBusy || confirmingPlan;
  $('#generate-plan').textContent = planBusy ? t("Planning with the model…") : t("Generate verification plan ↗");
  $('#new-task').disabled = busy || planBusy || confirmingPlan;
  syncFollowUp();
  const observedReview = activeReview() && !stale() && evidence?.agentProvenance?.reviewId === activeReview().reviewId;
  $('#agent-badge').textContent = planBusy ? t("GENERATING · NOT EXECUTED") : observedReview ? t("EXECUTED · EVIDENCE COLLECTED") : activeReview() ? t("REVIEWED · READY TO TEST") : planStale() ? t("INPUT CHANGED · REGENERATE") : agentPlan ? t(agentPlan.status.replaceAll('_', ' ').toUpperCase()) : t("NOT GENERATED");
  const button = $('#confirm-plan');
  if (button) button.disabled = busy || planBusy || confirmingPlan || Boolean(planStale()) || agentPlan?.status !== 'awaiting_review';
  const notice = $('#plan-stale-notice');
  if (notice) notice.hidden = !planStale() || Boolean(activeReview());
  const review = activeReview();
  const acknowledgement = $('#confirm-plan-intent');
  if (acknowledgement) acknowledgement.disabled = Boolean(review) || Boolean(planStale()) || busy || confirmingPlan;
  const outcome = $('#agent-review-status');
  if (outcome && review) outcome.textContent = observedReview ? t("Execution complete: {0}/{1} cases passed. Inspect the observed evidence below.", evidence.passed, evidence.total) : t("Reviewed expectations are saved. Run verification on the current implementation to collect evidence.");
  else if (outcome && reviewedPlan) outcome.textContent = t("The current intent or suite no longer matches this review. Generate a new plan or treat edited cases as manually authored tests.");
  for (const card of document.querySelectorAll('.agent-candidate')) {
    const check = card.querySelector('[data-candidate-id]'), field = card.querySelector('[data-expected-id]');
    check.disabled = field.disabled = Boolean(review) || Boolean(planStale()) || agentPlan?.status !== 'awaiting_review' || busy || confirmingPlan;
    const approved = review?.provenance.approved.find(item => item.id === check.dataset.candidateId);
    card.querySelector('.candidate-state').textContent = approved ? t("USER CONFIRMED · EXPECTATION REVIEWED") : planStale() ? t("INPUT CHANGED · REGENERATE TO REVIEW") : t("PENDING CONFIRMATION · NOT EXECUTED");
  }
}

function syncFollowUp(){
  const eligible=evidence && !stale() && evidence.total>0 && evidence.passed===evidence.total && evidence.results.every(row=>row.status==='passed') && evidence.total<20;
  $('#challenge-passing').disabled=!eligible || !health?.ai.ready || busy || planBusy || confirmingPlan || hintBusy || mentorBusy || historyBusy;
  $('#challenge-passing').textContent=planBusy?t("Model request in progress…"):evidence && agentPlan?.challenge?.sourceRunId===evidence.id?t("Reopen saved challenge plan ↗"):t("Generate a follow-up challenge ↗");
  $('#followup-status').textContent=!evidence?t("Complete a passing run first."):stale()?t("Inputs changed. Run this version before asking for a challenge."):evidence.passed!==evidence.total?t("Resolve the current failures first."):evidence.total>=20?t("The 20-case limit is reached. Start a smaller task for additional exploration."):!health?.ai.ready?t("Configure AI to generate a follow-up challenge."):t("{0}/{1} supplied cases passed. Explore different inputs; existing expectations stay unchanged.", evidence.total, evidence.total);
}

async function generateFollowUp(){
  if(!evidence || stale() || evidence.passed!==evidence.total || evidence.total>=20 || busy || planBusy || confirmingPlan || mentorBusy || hintBusy)return;
  const source=structuredClone(currentRecord()),snapshot=currentSnapshot();
  planBusy=true;syncAgent();syncExecution();
  try{
    const result=await api('/api/agent/challenge',{runId:source.evidence.id,language:hintLanguage});
    agentPlan=result;planSnapshot=snapshot;reviewedPlan=null;baseline=source;renderAgentPlan();renderComparison();
    $('#agent-heading').scrollIntoView({block:'start'});
    toast(result.cached?t("Saved challenge reused. No new model call."):result.status==='no_new_candidates'?t("No new distinct cases were proposed. This is not proof of correctness."):t("Challenge proposals ready. Review each expected value before execution."));
  }catch(error){toast(error.message,true);}
  finally{planBusy=false;syncAgent();syncExecution();}
}

function renderAgentPlan() {
  const target = $('#agent-plan');
  if (!agentPlan) { target.replaceChildren(node('p', '', t("Add your intent and code below, then generate a plan. Existing test cases are optional."))); syncAgent(); return; }
  const summary = node('div', 'agent-summary');
  summary.append(node('h3', '', agentPlan.summary), node('p', '', t("{0} · {1} · {2} · {3} total tokens", t(agentPlan.provider), agentPlan.model || t('No model call'), formatTime(agentPlan.createdAt), agentPlan.usage.total_tokens ?? 'Unknown')));
  if(agentPlan.challenge){summary.append(node('p','',t("FOLLOW-UP CHALLENGE · Source {0} · {1}/{2} original tests passed. {3} repeated input(s) omitted.{4}", agentPlan.challenge.sourceRunId, agentPlan.challenge.sourcePassed, agentPlan.challenge.sourceTotal, agentPlan.challenge.omittedRepeatedInputs, agentPlan.cached?t(' Saved plan reused; no new model call. Token count above is original usage.'):'')));}
  const staleNotice = node('p', 'agent-warning', t("Input changed after this plan was generated. Regenerate before confirming.")); staleNotice.id = 'plan-stale-notice';
  const sections = [summary, staleNotice];
  function listSection(title, items, className = '') {
    if (!items.length) return;
    const section = node('section', `agent-section ${className}`), list = node('ul');
    section.append(node('h3', '', title)); items.forEach(item => list.append(node('li', '', item))); section.append(list); sections.push(section);
  }
  listSection(t("Clarify before testing"), agentPlan.questions, 'agent-warning');
  listSection(t("Assumptions to review"), agentPlan.assumptions);
  listSection(t("Hypotheses · not confirmed findings"), agentPlan.hypotheses.map(item => `${item.id}: ${item.claim} — ${item.basis}`));
  if (agentPlan.status === 'needs_clarification') sections.push(node('p', 'agent-warning', t("Update Intended Behavior with your answers, then generate a new plan. These candidates cannot be confirmed while questions remain.")));
  if (!agentPlan.candidates.length) sections.push(node('p', '', agentPlan.challenge?t("No new distinct candidates are available in this plan. This does not establish completeness or correctness."):t("No candidate cases were proposed. Refine your intent or generate a new plan.")));
  const grid = node('div', 'agent-candidates');
  for (const candidate of agentPlan.candidates) {
    const card = node('article', 'agent-candidate'), label = node('label', 'candidate-select'), check = node('input');
    check.type = 'checkbox'; check.dataset.candidateId = candidate.id; check.disabled = agentPlan.status !== 'awaiting_review';
    check.setAttribute('aria-label', t("Confirm expected value for {0}", candidate.title));
    label.append(check, node('strong', '', candidate.title));
    const state = node('span', 'candidate-state', t("PENDING CONFIRMATION · NOT EXECUTED"));
    const call = `${agentPlan.snapshot.functionName}(${[...candidate.args.map(v => JSON.stringify(v)), ...Object.entries(candidate.kwargs).map(([k,v]) => `${k}=${JSON.stringify(v)}`)].join(', ')})`;
    const input = node('pre', '', call), expectedLabel = node('label', 'case-input-label', t("Proposed expected return value · review or edit")), expected = node('textarea', 'case-value-input');
    expected.value = Object.hasOwn(candidate, 'expected') ? JSON.stringify(candidate.expected) : '';
    expected.rows = 2; expected.spellcheck = false; expected.dataset.expectedId = candidate.id;
    expected.setAttribute('aria-label', t("Expected value for {0}", candidate.title)); expected.disabled = agentPlan.status !== 'awaiting_review'; expectedLabel.append(expected);
    card.append(label, state, node('small', '', t("Hypothesis {0}", candidate.hypothesisId)), input, expectedLabel, node('p', '', candidate.rationale));
    grid.append(card);
  }
  sections.push(grid);
  if (agentPlan.status === 'awaiting_review') {
    const label = node('label', 'contract-confirm'), check = node('input'); check.type = 'checkbox'; check.id = 'confirm-plan-intent';
    label.append(check, node('span', '', t("I confirm the assumptions and the expected values of the cases I selected.")));
    const button = node('button', 'primary-button', t("Confirm selected cases")); button.id = 'confirm-plan'; button.addEventListener('click', confirmAgentPlan);
    const note = node('p', 'agent-disclosure', t("Confirmation adds only selected cases to the suite. It does not execute them. Use Run verification afterward. Existing manually authored cases are retained.{0}", agentPlan.challenge?' This expands the suite and releases any original Regression Guard; the original passing run remains the comparison baseline.':''));
    sections.push(label, button, note);
  }
  const outcome = node('p', 'agent-review-status'); outcome.id = 'agent-review-status'; sections.push(outcome);
  target.replaceChildren(...sections); syncAgent();
}

function renderAgentFindings() {
  const target = $('#agent-findings');
  target.hidden = !evidence?.agentProvenance;
  if (!evidence?.agentProvenance) { target.replaceChildren(); return; }
  const title = node('h3', '', t("Hypotheses → observed tests"));
  const source = node('p', '', t("{0} proposed the tests. You confirmed their expected values. Python produced the outcomes below.{1}", evidence.agentProvenance.plan.model, stale() ? ' Current inputs have changed; these findings refer to the completed submission.' : ''));
  const items = (evidence.agentFindings || []).map(finding => {
    const item = node('div', `finding ${finding.status}`);
    const label = finding.status === 'observed_violation' ? t("Linked test failed · the claimed cause remains a hypothesis") : finding.status === 'not_refuted_by_selected_cases' ? t("Selected cases passed · broader behavior remains unverified") : t("Not checked · no confirmed linked cases executed");
    item.append(node('strong', '', finding.claim), node('p', '', t("{0}. {1} linked cases checked.", label, finding.checkedCases))); return item;
  });
  target.replaceChildren(title, source, ...items);
}

async function generateAgentPlan() {
  if (planBusy || busy || confirmingPlan) return;
  let submission;
  try {
    submission = current();
    if (!submission.code.trim() || !submission.functionName || !submission.intent.trim()) throw new Error(t("Fill in Intended Behavior, your Python code, and the target function first."));
    if (!Array.isArray(submission.cases)) throw new Error(t("Test cases must be an array. Use [] for no existing cases."));
  } catch (error) { toast(error instanceof SyntaxError ? t("Fix the existing cases JSON first, or start a blank task.") : error.message, true); return; }
  const snapshot = JSON.stringify(submission);
  planBusy = true; syncAgent();
  try {
    const result = await api('/api/agent/plan', {...submission,language:hintLanguage});
    agentPlan = result; planSnapshot = snapshot; reviewedPlan = null; renderAgentPlan();
    toast(result.status === 'needs_clarification' ? t("Your intent needs clarification. Update it before confirming tests.") : t("Plan generated. Review every expected value before confirming."));
  } catch (error) { toast(error.message, true); }
  finally { planBusy = false; syncAgent(); }
}

async function confirmAgentPlan() {
  if (!agentPlan || planStale() || confirmingPlan || busy) return;
  try {
    if (!$('#confirm-plan-intent')?.checked) throw new Error(t("Confirm the assumptions and selected expected values first."));
    const reviews = [...document.querySelectorAll('[data-candidate-id]:checked')].map(check => {
      const candidate = agentPlan.candidates.find(row => row.id === check.dataset.candidateId);
      const field = [...document.querySelectorAll('[data-expected-id]')].find(el => el.dataset.expectedId === candidate.id);
      let expected; try { expected = JSON.parse(field.value); } catch { throw new Error(`Enter a valid JSON expected value for “${candidate.title}”.`); }
      return { caseId: candidate.id, expected, confirmed: true };
    });
    if (!reviews.length) throw new Error(t("Select at least one case whose expected value you have reviewed."));
    const snapshot = currentSnapshot(); confirmingPlan = true; syncAgent();
    const challengeBaseline=agentPlan.challenge?await api(`/api/history/${agentPlan.challenge.sourceRunId}`):null;
    const review = await api('/api/agent/confirm', { planId: agentPlan.id, confirmIntent: true, reviews });
    if (currentSnapshot() !== snapshot) throw new Error(t("The editor changed during confirmation. Regenerate and review the plan for the new input."));
    reviewedPlan = review; $('#cases').value = JSON.stringify(review.submission.cases, null, 2); editorChanged();
    if(challengeBaseline){replaySuite=null;baseline=challengeBaseline;editorChanged();}
    $('#agent-review-status').textContent = t("{0} candidate expected values confirmed. Run verification to collect actual evidence.", review.provenance.approved.length);
    toast(t("Selected cases confirmed and added. Run verification to test them."));
  } catch (error) { toast(error.message, true); }
  finally { confirmingPlan = false; syncAgent(); }
}

function renderCaseCards() {
  const target = $('#case-cards');
  let cases;
  try { cases = JSON.parse($('#cases').value); if (!Array.isArray(cases)) throw new Error(); }
  catch { target.replaceChildren(node('p', 'case-edit-error', t("Fix the JSON in Advanced to display test cards."))); return; }
  const cards = cases.map((item, i) => {
    const card = node('article', 'test-card');
    const result = evidence && !stale() ? evidence.results[i] : null;
    const top = node('div', 'test-card-top');
    top.append(node('strong', '', t("TEST {0}", String(i + 1).padStart(2, '0'))), node('span', `case-outcome ${result?.status || ''}`, result ? result.status === 'passed' ? t("✓ Passed") : result.status === 'error' ? t("! Execution error") : t("✕ Mismatch") : t("Not tested · Run verification")));
    const fields = node('div', 'test-card-values');
    const args = Array.isArray(item?.args) ? item.args.map(v => JSON.stringify(v)) : [t("Invalid arguments")];
    const kwargs = item?.kwargs && typeof item.kwargs === 'object' ? Object.entries(item.kwargs).map(([k,v]) => `${k}=${JSON.stringify(v)}`) : [];
    for (const [label, text] of [[t("INPUT · FUNCTION CALL"), `${$('#function-name').value.trim() || 'your_function'}(${[...args,...kwargs].join(', ')})`], [t("EXPECTED RETURN VALUE"), JSON.stringify(item?.expected)]]) {
      const field = node('div'); field.append(node('small', '', label), node('pre', '', text ?? t("Missing expected value"))); fields.append(field);
    }
    if (result) {
      const field = node('div', result.status === 'passed' ? 'actual-pass' : 'actual-fail');
      field.append(node('small', '', result.status === 'error' ? t("OBSERVED ERROR") : t("ACTUAL RETURN VALUE")), node('pre', '', result.error || JSON.stringify(result.actual)));
      fields.append(field);
      fields.append(node('p', 'case-explanation', result.status === 'passed' ? t("Actual output matches your expectation.") : result.status === 'error' ? t("The function raised an error instead of returning a value.") : t("Actual output differs from your expectation.")));
      if (evidence.agentProvenance?.approved.some(candidate => caseKey(candidate) === caseKey(item))) fields.append(node('p', 'case-source', t("AI-proposed test · expected value confirmed by you")));
    }
    const actions = node('div', 'test-card-actions'), edit = node('button', 'text-button', t("Edit case")), remove = node('button', 'text-button', t("Remove"));
    edit.addEventListener('click', () => openCaseEditor(i));
    remove.addEventListener('click', async () => { if(!await confirmAction(t('Remove test case {0}? This changes the draft; saved runs are kept.',i+1)))return;cases.splice(i, 1); $('#cases').value = JSON.stringify(cases, null, 2); editorChanged(); });
    edit.disabled = remove.disabled = busy; actions.append(edit, remove);
    if (result) {
      const trace = node('button', 'text-button', t("Explore execution ↗"));
      trace.addEventListener('click', () => openTrace(i)); actions.append(trace);
    }
    card.append(top, fields, actions); return card;
  });
  target.replaceChildren(...cards);
  $('#new-case').disabled = cases.length >= 20 || busy;
}

function addArgument(value = '') {
  const row = node('div', 'argument-row'), label = node('label', 'case-input-label', t("Argument")), input = node('input', 'case-value-input');
  input.value = value; input.setAttribute('aria-label', t("Argument value")); input.spellcheck = false;
  const remove = node('button', 'text-button', t("Remove argument")); remove.addEventListener('click', () => row.remove());
  label.append(input); row.append(label, remove); $('#argument-fields').append(row);
}

function openCaseEditor(index) {
  if (busy) return;
  try {
    const cases = JSON.parse($('#cases').value);
    if (!Array.isArray(cases)) throw new Error(t("Fix the JSON array in Advanced first."));
    const item = index === null ? { args: [''], expected: null } : cases[index];
    if (!item || !Array.isArray(item.args)) throw new Error(t("Fix this case in Advanced first."));
    editingCase = index; $('#case-dialog-heading').textContent = index === null ? t("Add a test case") : t("Edit test {0}", index + 1);
    $('#argument-fields').replaceChildren(); item.args.forEach(value => addArgument(JSON.stringify(value)));
    $('#expected-input').value = JSON.stringify(item.expected ?? null); $('#case-edit-error').textContent = '';
    $('#case-dialog').dataset.kwargs=JSON.stringify(item.kwargs||{});
    document.dispatchEvent(new CustomEvent('case-editor-open',{detail:{...item,newCase:index===null,functionName:$('#function-name').value.trim(),code:$('#code').value}}));
    $('#case-dialog').showModal();
  } catch (error) { toast(error.message, true); }
}

function loadExample(index, announce = true) {
  verificationTasks?.reset();
  $('#code-language').value='python';$('#code').dataset.codeLanguage='python';queueMicrotask(()=>syncCodeLanguage());
  $('#lesson-import-note').hidden=true;
  replaySuite=null;
  selectedPracticeId=null;
  repairJourney = null;
  const example = examples[index];
  selectedExample = example.functionName; confirmedContract = null; challengeProvenance = null;
  $('#confirm-contract').checked = false;
  if (announce) baseline = null;
  $('#code').value = example.code;
  $('#function-name').value = example.functionName;
  $('#intent').value = challengePacks[example.functionName].contract;
  $('#cases').value = JSON.stringify(example.cases, null, 2);
  editorChanged();
  if (announce) toast(t("Loaded “{0}”. Run verification to see results.", example.title));
}

function activePack() {
  if($('#code-language').value!=='python')return null;
  const pack = selectedExample === $('#function-name').value.trim() ? challengePacks[selectedExample] : null;
  return pack && $('#intent').value.trim() === pack.contract ? pack : null;
}

function syncChallenge() {
  const pack = activePack();
  if (!pack || confirmedContract !== selectedExample) $('#confirm-contract').checked = false;
  $('#challenge-contract').textContent = pack?.contract || t("Curated challenges require an unchanged practice-example intent and matching function. Load an example, or author your own cases for custom behavior.");
  $('#confirm-contract').disabled = !pack || busy;
  $('#challenge-button').disabled = !pack || !$('#confirm-contract').checked || busy;
  $('#challenge-status').textContent = !pack ? t("No curated contract selected for this function.") : !$('#confirm-contract').checked ? t("Confirm the contract before adding its edge cases.") : t("Expected values follow your confirmed contract. Results require a real run.");
  $('#pin-baseline').disabled = !evidence || Boolean(stale()) || busy;
}

function currentRecord() {
  return evidence && { submission: JSON.parse(runSnapshot), evidence, provenance: runProvenance };
}

function openTrace(index) {
  revealWorkspace("trace-heading");
  traceIndex = index; traceStep = 0; $('#trace-case').value = String(index); renderTrace();
  $('#trace-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function traceOptions() {
  const select = $('#trace-case'); select.replaceChildren(); select.disabled = !evidence;
  if (!evidence) return;
  evidence.results.forEach((row, i) => {
    const option = node('option', '', t("Test {0} · {1}", i + 1, row.status === 'passed' ? 'Passed' : row.status === 'error' ? 'Execution error' : 'Mismatch'));
    option.value = String(i); select.append(option);
  });
  const failure = evidence.results.findIndex(row => row.status !== 'passed');
  traceIndex = failure >= 0 ? failure : 0; traceStep = 0; select.value = String(traceIndex);
}

function renderTrace() {
  walkthroughUI?.syncWorkspace(currentRecord(),traceIndex,Boolean(stale()));
  if (!evidence) return;
  const result = evidence.results[traceIndex];
  if (!result) return;
  const submission = JSON.parse(runSnapshot), events = Array.isArray(result.trace) ? result.trace : [];
  $('#trace-summary').textContent = t("Test {0} · Expected {1} · {2}{3}{4}", traceIndex + 1, JSON.stringify(submission.cases[traceIndex].expected), result.status === 'error' ? result.error : `${t('Actual')} ${JSON.stringify(result.actual)}`, result.errorLine ? ` · Reported error at line ${result.errorLine}` : '', stale() ? ' · Earlier submission: the editor has changed.' : '');
  $('#trace-limit').textContent = `${t(result.traceNote) || t("No trace metadata was returned for this run.")}${result.traceTruncated ? ' CAPTURE LIMIT REACHED: later events are omitted. This is a partial trace.' : ''}`;
  const target = $('#trace-view');
  if (!events.length) { target.replaceChildren(node('p', '', t("No function events were captured. Syntax errors, module initialization errors, disabled tracing, or capture limits may leave no trace. The error/result above remains the observed outcome."))); return; }
  traceStep = Math.min(Math.max(0, traceStep), events.length - 1);
  const event = events[traceStep];
  const controls = node('div', 'trace-controls');
  const previous = node('button', 'secondary-button', t("← Previous")), next = node('button', 'secondary-button', t("Next →"));
  previous.disabled = traceStep === 0; next.disabled = traceStep === events.length - 1;
  previous.addEventListener('click', () => { traceStep--; renderTrace(); }); next.addEventListener('click', () => { traceStep++; renderTrace(); });
  const select = node('select'); select.setAttribute('aria-label', t("Execution step"));
  events.forEach((step, i) => { const option = node('option', '', t("{0}/{1} · {2} · line {3} · {4}", i + 1, events.length, step.event, step.line, step.function)); option.value = String(i); select.append(option); });
  select.value = String(traceStep); select.addEventListener('change', () => { traceStep = Number(select.value); renderTrace(); });
  controls.append(previous, select, next);
  const panes = node('div', 'trace-panes'), source = node('div', 'trace-source');
  source.setAttribute('aria-label', t("Submitted source with current execution line"));
  const lines = submission.code.split('\n');
  let start = 0, end = lines.length;
  if (lines.length > 160) { start = Math.max(0, event.line - 11); end = Math.min(lines.length, event.line + 10); source.append(node('p', 'trace-source-note', t("Source preview is limited to the current line and nearby context."))); }
  for (let i = start; i < end; i++) {
    const line = node('div', i + 1 === event.line ? 'trace-line current' : 'trace-line');
    line.append(node('span', '', i + 1), node('code', '', lines[i] || ' ')); source.append(line);
  }
  const variables = node('div', 'trace-variables');
  const eventLabel = event.event === 'line' ? t("Before this line executes") : event.event === 'exception' ? t("Exception raised · it may be caught later") : event.event === 'return' ? t("Return event · an exception may also unwind a frame") : t("Function entered");
  variables.append(node('h3', '', eventLabel), node('p', '', t("{0} · line {1}", event.function, event.line)));
  if (event.exception) variables.append(node('p', 'trace-exception', t("Raised: {0}", event.exception)));
  if (Object.hasOwn(event, 'value')) variables.append(node('p', '', t("Returned/unwind value: {0}", event.value)));
  const table = node('table');
  for (const [key, value] of Object.entries(event.variables || {})) { const row = node('tr'); row.append(node('th', '', key), node('td', '', value)); table.append(row); }
  variables.append(table);
  if (!Object.keys(event.variables || {}).length) variables.append(node('p', '', t("No local variables captured at this step.")));
  variables.append(node('small', '', t("Up to 8 locals per event. Long and nested values are abbreviated; custom objects are not expanded.")));
  panes.append(source, variables); target.replaceChildren(controls, panes);
  source.scrollTop = Math.max(0, (event.line - start - 4) * 24);
}

function renderComparison() {
  const target = $('#comparison-content');
  $('#clear-baseline').hidden = !baseline;
  if (!baseline) {
    target.replaceChildren(node('p', '', t("Pin a completed run as your baseline. After finding a failing edge case, pin that run, edit the code, and verify again.")));
    return;
  }
  const caption = node('p', 'comparison-caption', t("Baseline: {0} · {1}/{2} passed · {3}", formatTime(baseline.evidence.createdAt), baseline.evidence.passed, baseline.evidence.total, baseline.submission.functionName));
  if (!evidence || baseline.evidence.id === evidence.id) {
    target.replaceChildren(caption, node('p', '', t("Baseline pinned for this session. Edit the code or add cases, then run verification.")));
    return;
  }
  const compared = compareRuns(baseline, currentRecord());
  if (!compared.compatible) {
    target.replaceChildren(caption, node('p', '', t("The function or intended behavior differs between runs. Pin a new baseline for this task.")));
    return;
  }
  const summary = node('div', 'comparison-stats');
  for (const [value, label, style] of [[compared.fixed, t("Fixed"), 'fixed'], [compared.regressed, t("Regressed"), 'regressed'], [compared.added, t("New cases"), ''], [compared.removed, t("Removed"), '']]) {
    const stat = node('div', style); stat.append(node('strong', '', value), node('span', '', label)); summary.append(stat);
  }
  const note = node('p', 'comparison-caption', t("{0} identical cases compared. Changed inputs or expected values count as new/removed cases, never as fixes.{1}", compared.shared, stale() ? ' The editor has changed; this comparison is between completed runs.' : ''));
  const table = node('table', 'comparison-table'), thead = node('thead'), header = node('tr');
  for (const label of [t("Case / expectation"), t("Baseline"), t("Latest run"), t("Change")]) header.append(node('th', '', label));
  thead.append(header); table.append(thead);
  const tbody = node('tbody');
  const status = row => !row ? t("Not run") : row.status === 'passed' ? t("Passed") : row.status === 'error' ? t("Error") : t("Mismatch");
  const labels = { fixed: t("Fixed"), regressed: t("Regressed"), added: t("New case"), removed: t("Removed"), passing: t("Still passing"), unresolved: t('Still failing') };
  const observed = result => {
    const cell = node('td');
    cell.append(node('strong', 'comparison-status', status(result)));
    if (result) {
      cell.append(node('small', 'comparison-value-label', t(result.status === 'error' ? 'OBSERVED ERROR' : 'ACTUAL RETURN VALUE')));
      cell.append(node('pre', 'comparison-value', result.status === 'error' ? result.error || t('Error') : outputLabel(result.actual)));
    }
    return cell;
  };
  for (const row of compared.rows) {
    const tr = node('tr');
    const input = node('td');
    input.append(node('small', 'comparison-value-label', t('INPUT · FUNCTION CALL')), node('pre', 'comparison-call', callLabel(latestSubmission(), row.item)), node('small', 'comparison-value-label', t('EXPECTED RETURN VALUE')), node('pre', 'comparison-value', outputLabel(row.item.expected)));
    tr.append(input, observed(row.previous), observed(row.result), node('td', row.transition, labels[row.transition])); tbody.append(tr);
  }
  table.append(tbody);
  const scroll = node('div', 'comparison-scroll'); scroll.append(table);
  const diff = node('details', 'diff-block'); diff.open = true;
  diff.append(node('summary', '', t("Code changes · baseline → latest completed run")));
  const changes = codeDiff(baseline.submission.code, currentRecord().submission.code);
  const pre = node('pre', 'code-diff');
  for (const change of changes.slice(0, 400)) pre.append(node('span', change.kind, `${change.kind === 'added' ? '+' : change.kind === 'removed' ? '-' : ' '} ${change.text}\n`));
  if (!changes.length) pre.textContent = t("No code changes between these runs.");
  if (changes.length > 400) pre.append(node('span', '', t("\nPreview truncated. Export the report for complete source snapshots.")));
  diff.append(pre); target.replaceChildren(caption, summary, note, scroll, diff);
}

function syncHint() {
  const hint = hints[level];
  const p = node('p', '', hint || guideText[level]);
  const small = node('small', '', hint ? t("AI suggestion · {0} · Saved hint · Not verified", hintDetails[level]?.model || health?.ai.model || 'Configured model') : t("Example learning prompt · Your code has not been analyzed by AI"));
  $('#hint-content').replaceChildren(node('span', 'hint-quote', '“'), p, small);
  if (stale()) {
    p.textContent = t("Your code or cases have changed. Rerun verification to get hints based on current evidence.");
    small.textContent = t("Collect fresh test evidence first");
  }
  const unavailable = (!hint && !health?.ai.ready) || !evidence || stale() || busy || hintBusy;
  $('#hint-button').disabled = Boolean(unavailable);
  $('#hint-button').textContent = hintBusy ? t("Analyzing…") : hint ? t("Show saved hint ↗") : t("Generate hint ↗");
  $('#ai-state').textContent = !health ? t("Checking AI configuration…") : !health.ai.ready ? t("AI not configured · Set up .env") : !evidence ? t("Run verification before requesting a hint") : stale() ? t("Rerun verification first") : t("{0} · Configured", health.ai.model);
}

async function api(url, data) {
  let response;
  try { response = await fetch(url, data === undefined ? { signal: AbortSignal.timeout(16000) } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(data.codeLanguage&&data.codeLanguage!=='python'?85000:data.execution==='modal'?160000:url==='/api/lessons/generate'?100000:url==='/api/lessons/taiwan-narration'?65000:url==='/api/lessons/narration'?130000:url==='/api/lessons/example'?60000:url.startsWith('/api/interviews/')?(data.execution==='docker'?60000:35000):url==='/api/shrink' || url==='/api/mutations/check'?120000:url === '/api/agent/plan' || url === '/api/agent/challenge' || url==='/api/requirements/plan' ? 55000 : url === '/api/hint' || url === '/api/mentor/feedback' ? 35000 : 25000) }); }
  catch { throw new Error(t("Connection lost or timed out. Check that the local server is running, then check the environment again.")); }
  let result;
  try { result = await response.json(); } catch { throw new Error(t("Unable to read the server response. Refresh the page.")); }
  if (!response.ok) throw new Error(result.error || t("Request failed. Please try again."));
  return result;
}

async function checkHealth() {
  $('#refresh-health').disabled = true;
  $('#refresh-health').textContent = t("Checking…");
  try {
    health = await api('/api/health');
    $('#runner-title').textContent = health.runner.ready ? t("Python runner is ready") : t("Execution environment is not ready");
    $('#runner-message').textContent = t(health.runner.message);
    $('.environment-bar').classList.toggle('ready', health.runner.ready);
  } catch (error) {
    health = null;
    $('#runner-title').textContent = t("Unable to reach the local server");
    $('#runner-message').textContent = error.message;
    $('.environment-bar').classList.remove('ready');
  } finally {
    $('#refresh-health').disabled = false;
    $('#refresh-health').textContent = t("Check again ↻");
    syncHint(); syncAgent(); renderRepairJourney(); renderLearning(); syncExecution();
  }
}

function displayResults() {
  const allPassed = evidence.passed === evidence.total, submission = latestSubmission();
  const failed = evidence.results.filter(row => row.status === 'failed').length, errors = evidence.results.filter(row => row.status === 'error').length;
  const stats = node('div', 'evidence-counts');
  for (const [count, label, kind] of [[evidence.passed, t("Passed"), 'pass'], [failed, t("Wrong output"), 'fail'], [errors, t("Execution errors"), 'fail']]) {
    const stat = node('div', kind); stat.append(node('strong', '', count), node('span', '', label)); stats.append(stat);
  }
  const title = node('h3', '', allPassed ? t("Your outputs match all supplied expectations.") : t("{0} of {1} tests need attention.", failed + errors, evidence.total));
  const note = node('p', '', t("OBSERVED OUTPUTS · Executed by Python, checked against the supplied expectations.")); note.id = 'evidence-snapshot-note';
  $('#evidence-summary').className = 'evidence-summary evidence-overview';
  $('#evidence-summary').replaceChildren(title, stats, note);
  const rows = evidence.results.map((result, index) => ({ result, index })).sort((a, b) => Number(a.result.status === 'passed') - Number(b.result.status === 'passed')).map(({ result, index }) => {
    const card = node('article', `observed-card ${result.status}`), passed = result.status === 'passed', error = result.status === 'error';
    const head = node('div', 'observed-top');
    head.append(node('strong', '', t("TEST {0}", String(index + 1).padStart(2, '0'))), node('span', '', passed ? t("✓ Passed") : error ? t("! Execution error") : t("✕ Wrong output")));
    const call = node('div', 'observed-call'); call.append(node('small', '', t("INPUT · FUNCTION CALL")), node('pre', '', callLabel(submission, submission.cases[index])));
    const values = node('div', 'observed-values');
    for (const [label, value, kind] of [[t("EXPECTED RETURN VALUE"), outputLabel(submission.cases[index].expected), 'expected'], [error ? t("OBSERVED ERROR") : t("ACTUAL RETURN VALUE"), error ? result.error : outputLabel(result.actual), passed ? 'matched' : 'different']]) {
      const field = node('div', kind); field.append(node('small', '', label), node('pre', '', value)); values.append(field);
    }
    const explanation = node('p', 'observed-explanation', passed ? t("The actual return value matches the expected value.") : error ? t("The function raised an error instead of returning the expected value.") : t("The function returned a different value. This input reproduces the mismatch."));
    const source = evidence.agentProvenance?.approved?.some(item => caseKey(item) === caseKey(submission.cases[index])) ? t("AI-proposed test · Expected value confirmed by you") : runProvenance?.cases.some(item => caseKey(item) === caseKey(submission.cases[index])) ? t("Curated example · Expected value follows the confirmed contract") : t("Supplied test · Checked against your expected value");
    const trace = node('button', 'text-button', t("See execution steps →")); trace.addEventListener('click', () => openTrace(index));
    card.append(head, call, values, explanation, node('p', 'observed-source', source), trace);
    if (result.stdout) { const output = node('details', 'observed-output'); output.append(node('summary', '', t("Printed output")), node('pre', '', result.stdout)); card.append(output); }
    return card;
  });
  $('#results').replaceChildren(...rows);
  $('#evidence-actions').hidden = false;
  $('#run-meta').textContent = `${formatTime(evidence.createdAt)} · ${(evidence.durationMs / 1000).toFixed(2)}s · ${evidence.execution==='modal-python'?t("Modal cloud CPU"):evidence.execution==='docker-python'?t("Local Docker"):t("Execution environment not recorded")}${evidence.cloud?.sandboxId?` · ${evidence.cloud.sandboxId}`:''}`;
  $('#step-two').classList.add('selected');
  traceOptions();
  editorChanged();
}

async function runVerification(options = {}) {
  if (busy || mentorBusy) return;
  let submission;
  try {
    submission = current();
    if(replaySuite && !matchesRegression(submission,replaySuite))throw new Error(t("The guarded contract or test suite changed. Restore the saved values, or release Regression Guard to run editable tests."));
    if (!submission.code.trim()) throw new Error(t("Enter your code first."));
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(submission.functionName)) throw new Error(t("Enter a valid function name."));
    if (!Array.isArray(submission.cases) || submission.cases.length < 1 || submission.cases.length > 20) throw new Error(t("Provide between 1 and 20 JSON test cases."));
    for (const item of submission.cases) if (!item || !Array.isArray(item.args) || !Object.hasOwn(item, 'expected')) throw new Error(t("Each case must include an args array and an expected value."));
  } catch (error) { toast(error instanceof SyntaxError ? t("Test cases must be valid JSON. Check brackets, commas, and double quotes.") : error.message, true); return; }
  const submittedSnapshot = JSON.stringify(submission);
  const submittedProvenance = activePack() && confirmedContract === selectedExample && challengeProvenance ? structuredClone(challengeProvenance) : null;
  busy = true;
  $('#run-button').disabled = true;
  $('#run-button span').textContent = selectedExecution()==='modal'?t("Starting cloud verification…"):t("Verifying…");
  $('#evidence-badge').textContent = t("Collecting evidence…");
  syncHint(); syncChallenge(); syncAgent(); renderCaseCards(); renderRepairJourney(); renderEvidenceNextStep(); renderRegression(); renderLearning(); renderSecurity(); syncExecution();
  try {
    const review = activeReview();
    const result = await api('/api/verify', { ...submission, execution:selectedExecution(), ...(evidence?.requirementMap && sameTask(latestSubmission(),submission)?{requirementSourceRunId:evidence.id}:{}), ...(replaySuite ? {replayOf:replaySuite.evidence.id} : {}), ...(options.prediction ? { prediction: options.prediction } : {}), ...(baseline ? { baselineRunId: baseline.evidence.id } : {}), ...(review ? { reviewId: review.reviewId } : {}) });
    learning=result.mentor || {}; delete result.mentor; learnerDraft.answer=''; learnerDraft.answerRunId=result.id;
    if(replaySuite)baseline=structuredClone(replaySuite);
    securityPreview=null;
    evidence = result; runSnapshot = submittedSnapshot; runProvenance = submittedProvenance; hints = {}; hintDetails = {}; restoredEvidence = false;
    if (result.results.some(row => row.status !== 'passed') && (!baseline || !sameTask(baseline.submission, submission))) baseline = structuredClone(currentRecord());
    if (repairJourney && !repairJourney.before && matchesDeliverySuite(submission) && result.results.some(row => row.status !== 'passed')) {
      repairJourney.before = structuredClone(currentRecord()); baseline = structuredClone(currentRecord());
    }
    $('#step-three').classList.remove('selected');
    displayResults();
    await saveWorkspace(); await refreshHistory();
    toast(t("{0} / {1} cases passed. {2}", result.passed, result.total, stale() ? 'The editor has changed; these results apply to the submitted version.' : 'Test evidence collected.'));
  } catch (error) {
    $('#evidence-badge').textContent = evidence ? t("Run incomplete · Previous results") : t("Run unsuccessful");
    $('#evidence-badge').className = 'neutral-badge failed';
    toast(error.message, true);
    await checkHealth();
  } finally {
    busy = false; $('#run-button').disabled = false; $('#run-button span').textContent = t("Run verification"); syncHint(); syncChallenge(); syncAgent(); renderCaseCards(); renderRepairJourney(); renderEvidenceNextStep(); renderLearning(); renderSecurity(); renderRegression(); syncExecution();
  }
}

$('#run-button').addEventListener('click', runVerification);
$('#generate-requirements').addEventListener('click',generateRequirements);
$('#requirements-nav').addEventListener('click',()=>$('#requirements-heading').scrollIntoView({behavior:'smooth'}));
$('#mutation-nav').addEventListener('click',()=>$('#mutation-heading').scrollIntoView({behavior:'smooth'}));
$('#check-mutations').addEventListener('click',checkMyTests);
for(const [value,contract] of Object.entries(shrinkContracts)){const option=node('option','',t(contract.label));option.value=value;$('#shrink-contract').append(option);}
$('#shrink-case').addEventListener('change',()=>{ $('#confirm-shrink-contract').checked=false;renderShrink(); });
$('#shrink-contract').addEventListener('change',()=>{ $('#confirm-shrink-contract').checked=false;renderShrink(); });
$('#confirm-shrink-contract').addEventListener('change',renderShrink);
$('#shrink-button').addEventListener('click',shrinkFailure);
const shrinkDemo=node('button','text-button',t("Load shrinking example · Replaces draft"));
shrinkDemo.addEventListener('click',()=>{
  if(busy || planBusy || confirmingPlan || mentorBusy || hintBusy || historyBusy)return;
  $('#new-task').click();$('#function-name').value='has_positive';
  $('#intent').value=shrinkContracts.any_positive.label;
  $('#code').value='def has_positive(values):\n    for index in range(len(values) - 1):\n        if values[index] > 0:\n            return True\n    return False';
  $('#cases').value=JSON.stringify([{args:[[0,0,0,7]],expected:true},{args:[[0,-1]],expected:false}],null,2);
  $('#shrink-contract').value='any_positive';$('#confirm-shrink-contract').checked=false;
  editorChanged();$('#code-heading').scrollIntoView({block:'center'});toast(t("Curated shrinking example loaded. Run verification, then confirm the rule in Make the failure smaller."));
});
$('#shrink-result').after(shrinkDemo);
$('#challenge-passing').addEventListener('click',generateFollowUp);
$('#execution-backend').addEventListener('change',syncExecution);
$('#confirm-regression').addEventListener('change',()=>{$('#load-regression').disabled=!$('#confirm-regression').checked;});
$('#load-regression').addEventListener('click',()=>{
  if(!regressionPreview || !$('#confirm-regression').checked || busy || mentorBusy || hintBusy || planBusy || confirmingPlan)return;
  replaySuite=regressionPreview;baseline=structuredClone(regressionPreview);
  $('#function-name').value=replaySuite.submission.functionName;$('#intent').value=replaySuite.submission.intent || '';$('#cases').value=JSON.stringify(replaySuite.submission.cases,null,2);
  agentPlan=null;planSnapshot=null;reviewedPlan=null;selectedExample=null;confirmedContract=null;challengeProvenance=null;repairJourney=null;
  renderAgentPlan();$('#regression-dialog').close();editorChanged();$('#regression-guard').scrollIntoView({block:'center'});
  toast(t("Saved suite loaded. Your code was kept unchanged. Run the guard to collect fresh evidence."));
});
$('#review-security').addEventListener('click',reviewCurrentSecurity);
$('#generate-plan').addEventListener('click', generateAgentPlan);
$('#agent-nav').addEventListener('click', () => $('#agent-heading').scrollIntoView({ behavior: 'smooth' }));
$('#new-task').addEventListener('click', () => {
  if (busy || planBusy || confirmingPlan || mentorBusy) return;
  verificationTasks?.reset();
  $('#lesson-import-note').hidden=true;
  repairJourney = null;
  replaySuite=null;
  selectedExample = null; confirmedContract = null; challengeProvenance = null; runProvenance = null;
  agentPlan = null; planSnapshot = null; reviewedPlan = null; baseline = null; evidence = null; runSnapshot = null; hints = {};
  hintDetails = {}; restoredEvidence = false; void saveWorkspace();
  learning={}; learnerDraft={caseIndex:0,predictionText:'',answer:'',answerRunId:null};
  securityPreview=null;
  selectedPracticeId=null;
  $('#code').value = ''; $('#intent').value = ''; $('#function-name').value = ''; $('#cases').value = '[]';
  $('#confirm-contract').checked = false;
  $('#evidence-badge').textContent = t("Not run yet"); $('#evidence-badge').className = 'neutral-badge';
  $('#evidence-summary').className = 'evidence-summary';
  $('#evidence-summary').replaceChildren(node('h3', '', t("Start with your intended behavior.")), node('p', '', t("Generate a plan for your new function, confirm proposed expectations, then execute the selected cases.")));
  $('#results').replaceChildren(); $('#evidence-actions').hidden = true;
  $('#trace-case').replaceChildren(node('option', '', t("Run verification first"))); $('#trace-case').disabled = true;
  $('#trace-view').replaceChildren(node('p', '', t("No execution trace yet. A real run is required.")));
  $('#trace-summary').textContent = t("Select a completed test to inspect its actual execution path.");
  $('#step-two').classList.remove('selected'); $('#step-three').classList.remove('selected');
  renderAgentPlan(); renderAgentFindings(); editorChanged(); $('#intent').focus();
  toast(t("Started a blank task. Enter your intent, function name, and code. No prewritten tests are required."));
});
document.addEventListener('library-problem-selected',event=>{
  const {id,destination,confirmed}=event.detail||{},entry=libraryProblem(id,locale);
  if(!entry||!['learn','verify'].includes(destination)||busy||hintBusy||planBusy||confirmingPlan||mentorBusy||historyBusy||$('#solution-problem').disabled){event.preventDefault();return;}
  if(destination==='learn'){$('#solution-problem').value=entry.problem;revealWorkspace('solution-generator-title');$('#solution-generator-title').scrollIntoView({block:'start'});toast(t('Problem loaded. Press Generate when you want the lesson.'));return;}
  if(confirmed!==true){event.preventDefault();return;}
  $('#new-task').click();$('#code').value=entry.code;$('#intent').value=entry.problem;$('#function-name').value=entry.functionName;$('#cases').value=JSON.stringify(entry.cases,null,2);editorChanged();revealWorkspace('code-heading');$('#code-heading').scrollIntoView({block:'start'});toast(t('Problem and reviewed examples loaded. Write your solution, then run verification.'));
});
let previousLessonDraft=null;
function importLessonSolution(lesson){
  if(busy||hintBusy||planBusy||confirmingPlan||mentorBusy||historyBusy){toast(t('Wait for the current operation before importing a lesson.'),true);return false;}
  try{
    const draft=lessonVerificationDraft(lesson),previous=captureEditorDraft(document);
    $('#new-task').click();previousLessonDraft=previous;
    $('#code').value=draft.code;$('#intent').value=draft.intent;$('#function-name').value=draft.functionName;$('#cases').value='[]';
    $('#lesson-import-source').textContent=t('From lesson: {0}. Check the target function: {1}.',lesson.title,draft.functionName);
    $('#lesson-import-note').hidden=false;
    editorChanged();revealWorkspace('code-heading');$('#lesson-import-note').scrollIntoView({block:'start'});
    toast(t('Solution imported. No execution or model request. Add a test and confirm its expected value.'));return true;
  }catch(error){toast(t(error.message),true);return false;}
}
$('#lesson-import-add-case').addEventListener('click',()=>$('#new-case').click());
$('#lesson-import-undo').addEventListener('click',()=>{
  if(!previousLessonDraft||busy||hintBusy||planBusy||confirmingPlan||mentorBusy||historyBusy)return;
  const previous=previousLessonDraft;$('#new-task').click();restoreEditorDraft(document,previous);previousLessonDraft=null;$('#lesson-import-note').hidden=true;editorChanged();toast(t('Previous editor draft restored. Run again for fresh evidence.'));
});
$('#start-repair').addEventListener('click', () => {
  if (busy || planBusy || confirmingPlan || mentorBusy) return;
  $('#new-task').click();
  $('#intent').value = deliveryDemo.intent; $('#function-name').value = deliveryDemo.functionName;
  $('#code').value = deliveryDemo.code; $('#cases').value = JSON.stringify(deliveryDemo.cases, null, 2);
  repairJourney = { before: null, hintShown: false }; editorChanged();
  $('#repair-heading').scrollIntoView({ block: 'start' });
  toast(t("Delivery demo loaded. No model calls; test results require a real Python run."));
});
$('#trace-case').addEventListener('change', () => { traceIndex = Number($('#trace-case').value); traceStep = 0; renderTrace(); });
$('#trace-nav').addEventListener('click', () => $('#trace-heading').scrollIntoView({ behavior: 'smooth' }));
$('#mentor-nav').addEventListener('click', () => $('#mentor-heading').scrollIntoView({ behavior: 'smooth' }));
$('#new-case').addEventListener('click', () => openCaseEditor(null));
$('#add-argument').addEventListener('click', () => addArgument());
$('#save-case').addEventListener('click', () => {
  try {
    const cases = JSON.parse($('#cases').value);
    if (!Array.isArray(cases)) throw new Error(t("Test cases must be an array."));
    const args = [...document.querySelectorAll('#argument-fields input')].map((el, i) => {
      try { return JSON.parse(el.value); } catch { throw new Error(`Argument ${i + 1}: use a number, list, quoted text, boolean, or null.`); }
    });
    let expected; try { expected = JSON.parse($('#expected-input').value); } catch { throw new Error(t("Enter a valid expected value. Text must be in double quotes.")); }
    const updated={args,expected},kwargs=JSON.parse($('#case-dialog').dataset.kwargs||'{}');
    if(Object.keys(kwargs).length||cases[editingCase]?.kwargs)updated.kwargs=kwargs;
    if (editingCase === null) { if (cases.length >= 20) throw new Error(t("The limit is 20 cases.")); cases.push(updated); }
    else cases[editingCase] = { ...cases[editingCase], ...updated };
    $('#cases').value = JSON.stringify(cases, null, 2); $('#case-dialog').close(); editorChanged();
  } catch (error) { $('#case-edit-error').textContent = error.message; }
});
$('#confirm-contract').addEventListener('change', () => {
  confirmedContract = $('#confirm-contract').checked ? selectedExample : null;
  if (!confirmedContract) challengeProvenance = null;
  syncChallenge(); saveDraft();
});
$('#challenge-button').addEventListener('click', () => {
  const pack = activePack();
  if (!pack || !$('#confirm-contract').checked || busy) return;
  const cards = pack.cases.map(item => {
    const card = node('article', 'challenge-case');
    card.append(node('p', '', item.reason), node('pre', '', JSON.stringify({ args: item.args, expected: item.expected }, null, 2))); return card;
  });
  $('#challenge-preview').replaceChildren(...cards); $('#challenge-dialog').showModal();
});
$('#add-challenge').addEventListener('click', () => {
  const pack = activePack();
  if (!pack || !$('#confirm-contract').checked || busy) { toast(t("Confirm the current contract first."), true); return; }
  try {
    const result = appendChallenge(JSON.parse($('#cases').value), pack);
    $('#cases').value = JSON.stringify(result.cases, null, 2);
    challengeProvenance = { source: 'human-authored-example-pack', contract: pack.contract, confirmedByUser: true, cases: pack.cases.map(({ args, expected }) => ({ args, expected })) };
    $('#challenge-dialog').close(); editorChanged();
    toast(result.added ? t("Added {0} curated edge cases. Run verification to test them.", result.added) : t("These edge cases are already in your suite."));
  } catch (error) { toast(error instanceof SyntaxError ? t("Fix the JSON in your test cases first.") : error.message, true); }
});
$('#pin-baseline').addEventListener('click', () => {
  if (!evidence || stale() || busy) return;
  baseline = structuredClone(currentRecord()); renderComparison(); renderEvidenceNextStep(); void saveWorkspace(); toast(t("Baseline pinned. Edit your code, then run verification to compare."));
});
$('#clear-baseline').addEventListener('click', () => { baseline = null; renderComparison(); renderEvidenceNextStep(); void saveWorkspace(); });
$('#refresh-history').addEventListener('click', () => refreshHistory());
$('#refresh-health').addEventListener('click', checkHealth);
for (const selector of ['#code', '#function-name', '#intent', '#cases']) $(selector).addEventListener('input', editorChanged);
$('#code').addEventListener('scroll', () => { $('#line-numbers').scrollTop = $('#code').scrollTop; });
for (const selector of ['#code', '#cases']) {
  $(selector).addEventListener('keydown', event => {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const el = event.target;
      el.setRangeText(selector === '#code' ? '    ' : '  ', el.selectionStart, el.selectionEnd, 'end'); editorChanged();
    }
  });
}
document.addEventListener('keydown', event => {
  if (!event.defaultPrevented && !event.target.closest?.('#learning-practice') && (event.ctrlKey || event.metaKey) && event.key === 'Enter' && document.body.dataset.mode==='verify' && !document.querySelector('.studio-mode-verify')?.hidden && !document.querySelector('dialog[open]')) { event.preventDefault(); runVerification(); }
});
$('#format-tests').addEventListener('click', () => {
  try { $('#cases').value = JSON.stringify(JSON.parse($('#cases').value), null, 2); editorChanged(); toast(t("Test cases formatted.")); }
  catch { toast(t("Invalid JSON. Check brackets, commas, and double quotes."), true); }
});
for (const el of document.querySelectorAll('.example-trigger, #examples-nav')) el.addEventListener('click', () => $('#examples-dialog').showModal());
for (const el of document.querySelectorAll('#guide-nav, #guide-top')) el.addEventListener('click', () => $('#guide-dialog').showModal());
for (const el of document.querySelectorAll('.close-dialog')) el.addEventListener('click', () => el.closest('dialog').close());
$('#workspace-nav').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); $('#code').focus({ preventScroll: true }); });
examples.forEach((example, index) => {
  const card = node('button', 'example-card');
  card.append(node('strong', '', example.title), node('span', '', example.tag), node('p', '', example.description));
  card.addEventListener('click', () => { loadExample(index); $('#examples-dialog').close(); });
  $('#example-list').append(card);
});
for (const tab of document.querySelectorAll('.hint-tab')) tab.addEventListener('click', () => {
  level = Number(tab.dataset.level);
  for (const other of document.querySelectorAll('.hint-tab')) { other.classList.toggle('selected', other === tab); other.setAttribute('aria-pressed', String(other === tab)); }
  syncHint();
});
async function requestHint(requestedLevel = level) {
  if (!evidence || stale() || hintBusy || busy || planBusy || confirmingPlan) return;
  const requestedId = evidence.id;
  const requestedRecord = currentRecord();
  hintBusy = true; syncHint(); renderRepairJourney();
  try {
    const result = hints[requestedLevel] ? { ...hintDetails[requestedLevel], hint: hints[requestedLevel], model: hintDetails[requestedLevel]?.model || health?.ai.model, cached: true } : await api('/api/hint', { runId: requestedId, level: requestedLevel,language:hintLanguage });
    if (evidence?.id === requestedId) {
      hints[requestedLevel] = result.hint;
      hintDetails[requestedLevel] = result;
      if (requestedLevel === 1 && repairJourney?.before && matchesDeliverySuite(requestedRecord.submission) && requestedRecord.evidence.results.some(row => row.status !== 'passed')) {
        repairJourney.aiHint = { ...result, runId: requestedId }; repairJourney.hintShown = true;
      }
      $('#step-three').classList.add('selected');
    }
  } catch (error) { toast(error.message, true); }
  finally { hintBusy = false; syncHint(); renderRepairJourney(); await refreshHistory(); }
}
$('#hint-button').addEventListener('click', () => requestHint());
$('#export-readable').addEventListener('click',()=>{
  if(!evidence)return;
  const html=readableReport({language:locale,submission:latestSubmission(),evidence,baseline,hints,hintDetails,mentor:learning,editorChanged:Boolean(stale())});
  const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  const link=node('a');link.href=url;link.download=`invarith-${evidence.id}-report.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast(t("Readable report downloaded. It contains the completed run, not unexecuted draft edits."));
});
$('#export-button').addEventListener('click', () => {
  if (!evidence) return;
    const report = { language:locale,display:reportPresentation({submission:latestSubmission(),evidence},locale),project: 'Invarith', submission: JSON.parse(runSnapshot), evidence, hints, mentor: learning, agentProvenance: evidence.agentProvenance || null, agentFindings: evidence.agentFindings || null, challengeProvenance: runProvenance, baseline, comparison: baseline ? compareRuns(baseline, currentRecord()) : null, note: t("Results apply only to the supplied cases. Model-proposed expected values require user confirmation. Curated challenges are human-authored. Changed expectations are not fixes. AI suggestions have not been verified. Predictions are learning responses, never test expectations or proof of independent skill.") };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const a = node('a'); a.href = url; a.download = `invarith-${evidence.createdAt.replaceAll(':', '-')}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000); toast(t("Submission and test evidence exported."));
});

// Start a new workspace; saved drafts remain available through explicit resume.
const resumeVerificationDraft=(()=>{try{return JSON.parse(localStorage.getItem('invarith-draft-v1')||'null');}catch{return null;}})();
$('#code').value='';$('#intent').value='';$('#function-name').value='';$('#cases').value='[]';hasDraft=false;selectedExample=null;confirmedContract=null;editorChanged();
walkthroughUI=initWalkthrough({toast,api,onVerifySolution:importLessonSolution});walkthroughUI.syncWorkspace(currentRecord(),traceIndex,Boolean(stale()));
interviewUI=initInterview({api,toast,getHealth:()=>health,isWorkspaceBusy:()=>busy || hintBusy || planBusy || confirmingPlan || mentorBusy || historyBusy,onWalkthrough:(record,index,label)=>walkthroughUI.openEvaluation(record,index,label)});
initWorkspaceLayout();
checkHealth();
renderTransferPractices();
refreshHistory(false);

// Keep language drafts separate from shared intent and cases.
let editorLanguage=$('#code-language').value;
const syncCodeLanguage=()=>{document.querySelector('.studio-app')?.classList.toggle('non-python-editor',$('#code-language').value!=='python');const lang=codeLanguages.find(row=>row.id===$('#code-language').value)||codeLanguages[0];const filename=document.querySelector('.editor-tab .editor-filename');if(filename)filename.textContent=lang.file;const note=$('#code-language-note');if(note){note.hidden=lang.id==='python';note.textContent=t(languageInstructions(lang.id));}const icon=document.querySelector('.editor-tab .file-icon');if(icon)icon.textContent=({python:'Py',javascript:'JS',typescript:'TS',java:'Java',cpp:'C++',csharp:'C#'})[lang.id]||lang.label.split(' ')[0];};
$('#code-language').addEventListener('change',()=>{const next=$('#code-language').value;try{localStorage.setItem('invarith-verify-language:'+($('#code').dataset.codeLanguage||editorLanguage),JSON.stringify({functionName:$('#function-name').value,code:$('#code').value}));let saved=JSON.parse(localStorage.getItem('invarith-verify-language:'+next)||'null');$('#code').value=saved?.functionName===$('#function-name').value?saved.code:languageStarter(next,$('#function-name').value,JSON.parse($('#cases').value));}catch{$('#code').value=languageStarter(next,$('#function-name').value);}editorLanguage=next;$('#code').dataset.codeLanguage=next;if(next!=='python')$('#execution-backend').value='docker';syncCodeLanguage();editorChanged();});
syncCodeLanguage();
verificationTasks=initVerificationTasks({api,hasDraft,resumeDraft:resumeVerificationDraft,isBusy:()=>busy||planBusy||confirmingPlan||hintBusy||historyBusy||mentorBusy||Boolean(interviewUI?.active?.()),
 capture:()=>({draft:{codeLanguage:$('#code-language').value,code:$('#code').value,functionName:$('#function-name').value,intent:$('#intent').value,cases:$('#cases').value},activeRunId:evidence?.id||null,baselineRunId:baseline?.evidence.id||null}),
 restore:async row=>{
  $('#new-task').click();
  const draft=row.draft;
  $('#code-language').value=draft.codeLanguage;$('#code').dataset.codeLanguage=draft.codeLanguage;
  $('#code').value=draft.code;$('#function-name').value=draft.functionName;$('#intent').value=draft.intent;$('#cases').value=draft.cases;
  selectedExample=null;confirmedContract=null;challengeProvenance=null;hasDraft=true;
  if(row.activeRunId)await openSavedRun(row.activeRunId,true,row.baselineRunId);
  $('#code-language').value=draft.codeLanguage;$('#code').dataset.codeLanguage=draft.codeLanguage;editorLanguage=draft.codeLanguage;syncCodeLanguage();editorChanged();await saveWorkspace();
 }
});
