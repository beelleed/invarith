import { compareRuns, codeDiff, caseKey } from './evidence-tools.mjs';
import { callLabel } from './evidence-view.mjs';
import { requirementCoverage, requirementLabels } from './requirement-tools.mjs';
import {chineseReadableReport} from './report-localization.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const json = value => JSON.stringify(value, null, 2) ?? 'Not recorded';
const pre = value => `<pre>${escape(value)}</pre>`;
const status = row => !row ? 'Not run' : row.status === 'passed' ? 'Passed' : row.status === 'error' ? 'Execution error' : 'Wrong output';
const paragraph = value => `<p>${escape(value)}</p>`;

export function readableReport({ submission, evidence, baseline = null, hints = {}, hintDetails = {}, mentor = {}, editorChanged = false, language = 'en' }) {
  if (!submission || !evidence || !Array.isArray(evidence.results)) throw new Error('A completed run is required to export a report.');
  if(language==='zh-TW')return chineseReadableReport({submission,evidence,baseline,hints,hintDetails,mentor,editorChanged});
  const parts = [`<header><p class="eyebrow">INVARITH / VERIFICATION RECORD</p><h1>Know what your code actually does.</h1>${paragraph(`${submission.functionName} · ${evidence.passed}/${evidence.total} supplied cases passed`)}${paragraph(`Run: ${evidence.id || 'Not recorded'} · Executed: ${evidence.createdAt || 'Not recorded'} · Environment: ${evidence.execution || 'Not recorded'}`)}</header>`,
    `<aside>Results describe the completed submission below. They are not a proof of correctness or a security certification.${editorChanged ? ' The workspace draft was edited after this run; those edits are not represented as executed evidence.' : ''}</aside>`,
    `<section><h2>Intended behavior</h2>${paragraph(submission.intent || 'No intent recorded.')}<p>Intent is context; the supplied test expectations determine pass/fail.</p><h3>Executed source</h3>${pre(submission.code)}</section>`];
  if(evidence.cloud)parts.push(`<section><h2>Cloud execution provenance</h2>${paragraph(`${evidence.cloud.provider} · Sandbox ${evidence.cloud.sandboxId}`)}${paragraph(`Network: ${evidence.cloud.network}. Lifetime limit: ${evidence.cloud.lifetimeSeconds}s after startup. Execution timeout: ${evidence.cloud.executionTimeoutSeconds}s. CPU request/limit: ${evidence.cloud.cpuRequest}/${evidence.cloud.cpuLimit}. Memory request/limit: ${evidence.cloud.memoryRequestMiB}/${evidence.cloud.memoryLimitMiB} MiB.`)}</section>`);
  if (evidence.agentProvenance) {
    const plan = evidence.agentProvenance.plan;
    parts.push(`<section><h2>AI planning provenance</h2>${paragraph(`${plan?.provider || 'Configured provider'} · ${plan?.model || 'Model not recorded'} · ${plan?.usage?.total_tokens ?? 'Unknown'} reported tokens`)}${paragraph(plan?.summary || '')}<p>Model-proposed expectations were confirmed by the user before execution. Model explanations remain hypotheses.</p></section>`);
  }
  if(evidence.requirementMap){
    const map=evidence.requirementMap;
    parts.push(`<section><h2>Requirement Coverage Map</h2>${paragraph(`${map.provider} · ${map.model} · ${map.usage.total_tokens ?? 'Unknown'} original reported tokens · Proposal source run ${map.sourceRunId}`)}<p>AI proposes statements and relevance links; the user confirms them. Status derives only from linked cases in this completed run. Supporting examples do not prove a requirement, correctness, exhaustive coverage, or completeness of this map.</p>`);
    for(const row of requirementCoverage(map,submission,evidence)){
      parts.push(`<article><h3>${escape(row.statement)}</h3>${paragraph(requirementLabels[row.status])}${paragraph(`Intent excerpt: ${row.sourceQuote}`)}${paragraph(row.reviewed?`User review saved: ${row.confirmedAt}`:'Not confirmed by the user.')}`);
      for(const link of row.links)parts.push(link.result?`${pre(callLabel(submission,link.item))}${paragraph(`Expected ${json(link.item.expected)} · ${link.result.status==='error'?link.result.error:`Actual ${json(link.result.actual)} · ${link.result.status}`}`)}`:paragraph('Previously linked input/expectation is absent from this run. No evidence transferred to a changed expected value.'));
      parts.push('</article>');
    }
    parts.push('</section>');
  }
  parts.push('<section><h2>Observed test evidence</h2>');
  evidence.results.map((result,index)=>({result,index})).sort((a,b)=>Number(a.result.status==='passed')-Number(b.result.status==='passed')).forEach(({result,index})=>{
    const item=submission.cases[index];
    const approved=evidence.agentProvenance?.approved?.some(candidate=>caseKey(candidate)===caseKey(item));
    parts.push(`<article class="case ${result.status==='passed'?'passed':'attention'}"><h3>Test ${index+1} · ${escape(status(result))}</h3><h4>Input / function call</h4>${pre(callLabel(submission,item))}<div class="values"><div><h4>Expected return value</h4>${pre(json(item.expected))}</div><div><h4>${result.status==='error'?'Observed error':'Actual return value'}</h4>${pre(result.status==='error'?result.error:json(result.actual))}</div></div>${paragraph(approved?'AI-proposed test · Expected value confirmed by the user':'Supplied test · Checked against its recorded expectation')}`);
    if(result.stdout)parts.push(`<details><summary>Printed output</summary>${pre(result.stdout)}</details>`);
    if(result.trace?.length)parts.push(`<details><summary>Observed execution trace · ${result.trace.length} captured events${result.traceTruncated?' · PARTIAL: capture limit reached':''}</summary>${paragraph(result.traceNote || 'Trace previews are bounded and may omit values.')}<table><thead><tr><th>Event</th><th>Line / function</th><th>Captured state</th></tr></thead><tbody>${result.trace.map(event=>`<tr><td>${escape(event.event)}</td><td>${escape(event.line)} · ${escape(event.function)}</td><td>${pre(json({variables:event.variables,...(event.exception?{exception:event.exception}:{}),...(Object.hasOwn(event,'value')?{value:event.value}:{})}))}</td></tr>`).join('')}</tbody></table></details>`);
    parts.push('</article>');
  });
  parts.push('</section>');
  if(baseline) {
    const compared=compareRuns(baseline,{submission,evidence});
    parts.push(`<section><h2>Before &amp; after</h2>${paragraph(`Baseline: ${baseline.evidence.id || 'Not recorded'} · ${baseline.evidence.passed}/${baseline.evidence.total} cases passed · ${baseline.evidence.createdAt || 'Time not recorded'}`)}`);
    if(!compared.compatible)parts.push('<p>The function or intent differs. These runs cannot establish a repair for the same task.</p>');
    else {
      parts.push(paragraph(`${compared.fixed} fixed · ${compared.regressed} regressed · ${compared.shared} identical cases · ${compared.added} new · ${compared.removed} removed`),'<p>Changed inputs or expected values count as new/removed cases, never as fixes.</p>');
      parts.push(`<table><thead><tr><th>Case / expected value</th><th>Before</th><th>After</th><th>Change</th></tr></thead><tbody>${compared.rows.map(row=>`<tr><td>${pre(callLabel(submission,row.item))}${pre(`Expected: ${json(row.item.expected)}`)}</td><td>${escape(status(row.previous))}</td><td>${escape(status(row.result))}</td><td>${escape(row.transition)}</td></tr>`).join('')}</tbody></table><h3>Code changes</h3>${pre(codeDiff(baseline.submission.code,submission.code).map(line=>`${line.kind==='added'?'+':line.kind==='removed'?'-':' '} ${line.text}`).join('\n') || 'No source changes.')}<details><summary>Baseline source</summary>${pre(baseline.submission.code)}</details>`);
    }
    parts.push('</section>');
  }
  if(evidence.regression){const guard=evidence.regression;parts.push(`<section><h2>Regression Guard</h2>${paragraph(`Suite source: ${guard.sourceRunId} · ${guard.total} unchanged saved cases`)}${paragraph(`${guard.fixed} fixed · ${guard.regressed} regressed · ${guard.unresolved} unresolved`)}${paragraph(guard.expectations)}</section>`);}
  if(evidence.followUpChallenge){const challenge=evidence.followUpChallenge;parts.push(`<section><h2>Follow-up counterexample challenge</h2>${paragraph(`Source passing run: ${challenge.sourceRunId} · ${challenge.originalCases} original cases · ${challenge.addedCases} confirmed added cases`)}${paragraph(`Observed added cases: ${challenge.newCaseFailures} failed or raised errors · ${challenge.newCasePasses} passed.`)}<p>New expectations were reviewed before execution. Prior passing cases and model proposals do not establish complete correctness.</p></section>`);}
  for(const report of Object.values(evidence.shrinks || {})){
    parts.push(`<section><h2>Counterexample shrinking · Local Docker</h2>${paragraph(report.message)}${paragraph(`Status: ${report.status} · Source case ${report.caseIndex+1} · ${report.attempts.length} executed cases`)}${paragraph(`User-confirmed contract: ${report.contractText}`)}<h3>Original observation</h3>${pre(json(report.original))}${report.reduced?`<h3>Smaller input · Replayed</h3>${pre(json(report.reduced))}`:''}${paragraph(report.minimality)}<details><summary>Executed candidates and replays</summary>${pre(json(report.attempts))}</details><p>The original code and tests were preserved. Changed inputs receive expectations from the explicitly confirmed contract. This is separate from repair verification.</p></section>`);
  }
  if(evidence.mutationCheck){
    const check=evidence.mutationCheck;
    parts.push(`<section><h2>Check my tests · Local mutation evidence</h2>${paragraph(`Source run ${check.sourceRunId} · ${check.createdAt} · ${check.status}`)}${paragraph(check.note || '')}${paragraph(check.limitations)}${check.baseline?`<h3>Original replay</h3>${pre(json(check.baseline.results))}`:''}`);
    for(const variant of check.variants)parts.push(`<article><h3>Line ${escape(variant.line)}: ${escape(variant.before)} → ${escape(variant.after)}</h3>${paragraph(variant.status)}${variant.reason?paragraph(variant.reason):''}<details><summary>Isolated source change</summary>${pre(codeDiff(submission.code,variant.code).map(line=>`${line.kind==='added'?'+':line.kind==='removed'?'-':' '} ${line.text}`).join('\n'))}</details>${variant.results?`<h4>Observed results against unchanged expectations</h4>${pre(json(variant.results))}`:''}</article>`);
    parts.push('<p>Variants were executed in isolated copies. Original source and test expectations were preserved. Reopening this report starts no execution.</p></section>');
  }
  const security=evidence.security;
  parts.push('<section><h2>Security Review · Static analysis</h2>');
  if(!security)parts.push('<p>No static review was recorded for this run. No security conclusion is available.</p>');
  else if(security.status!=='completed')parts.push(paragraph(`Review not completed: ${security.reason || security.status}. No security conclusion is available.`));
  else {
    parts.push(paragraph(`${security.engine} v${security.version} · ${security.rulesChecked.length} limited rule families · ${security.findings.length} warning(s)${security.truncated?' · PARTIAL: findings limit reached':''}`),'<p>Static warnings do not confirm exploitability. No warnings does not establish security. Functional test outcomes remain separate.</p>');
    for(const finding of security.findings)parts.push(`<article class="attention"><h3>${escape(finding.ruleId)} · Line ${escape(finding.line)}:${escape(finding.column)} · ${escape(finding.title)}</h3>${pre(finding.snippet)}${paragraph(finding.reason)}<h4>Review / mitigation</h4>${paragraph(finding.guidance)}${paragraph(finding.reference)}</article>`);
    parts.push(paragraph(security.limitations));
  }
  parts.push('</section>');
  if(mentor.prediction) {
    const index=mentor.prediction.caseIndex, observed=evidence.results[index];
    parts.push(`<section><h2>Predict → Explain → Reflect</h2>${paragraph(mentor.prediction.participation==='personal'?'Self-selected personal practice; not a skill assessment.':'Demonstration or unclassified practice; excluded from personal learning statistics.')}<p>Expected values and earlier runs may have been visible. This is not a blinded assessment.</p>${pre(callLabel(submission,submission.cases[index]))}<div class="values"><div><h4>Prediction</h4>${pre(json(mentor.prediction.value))}</div><div><h4>Observed</h4>${pre(observed.status==='error'?observed.error:json(observed.actual))}</div><div><h4>Test expectation</h4>${pre(json(submission.cases[index].expected))}</div></div>${paragraph(`Prediction submitted: ${mentor.prediction.capturedAt}`)}<h3>Saved explanation</h3>${paragraph(mentor.answer || 'No explanation saved.')}`);
    for(const feedback of Object.values(mentor.feedback || {}).filter(item=>item.answer===mentor.answer))parts.push(`<article><h3>AI reflection · Not verified</h3>${paragraph(`${feedback.model} · ${feedback.totalTokens ?? 'Unknown'} reported tokens`)}${paragraph(feedback.text)}</article>`);
    parts.push('</section>');
  }
  if(Object.keys(hints).length) {
    parts.push('<section><h2>Saved mentor hints · Not verified</h2>');
    for(const [level,hint] of Object.entries(hints))parts.push(`<h3>Hint level ${escape(level)}</h3>${paragraph(hintDetails[level]?.model || 'Model not recorded')}${paragraph(hint)}`);
    parts.push('</section>');
  }
  parts.push('<footer>Generated locally by Invarith from saved execution evidence. No new code execution or model request is performed by opening this report. This file includes submitted code and results; review its contents before sharing.</footer>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Invarith verification report · ${escape(submission.functionName)}</title><style>body{margin:0;background:#f3f5ef;color:#243b30;font:15px/1.7 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:36px 24px}header,section{background:white;border:1px solid #d7e0d6;border-radius:12px;padding:26px;margin-bottom:22px}header{background:#18382c;color:#edf9ec}h1{font-size:30px;line-height:1.3}h2{font-size:22px}h3{font-size:17px}h4{font-size:12px;letter-spacing:.04em}p{white-space:pre-wrap;overflow-wrap:anywhere}pre{font:13px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f4ed;color:#233f2d;padding:14px;border-radius:6px}article{padding:18px;border:1px solid #d7e3d6;border-radius:8px;margin:16px 0}.attention{border-left:4px solid #b76b3d;background:#fff9f2}.passed{border-left:4px solid #38805a}.values{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}.values>div{min-width:0}aside{padding:18px;background:#fff4df;border-radius:8px;margin-bottom:22px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:12px 8px;vertical-align:top;text-align:left;border-bottom:1px solid #d9e1d5;overflow-wrap:anywhere}table pre{font-size:12px;padding:8px}summary{cursor:pointer;font-weight:600;padding:12px 0}footer{font-size:12px;color:#586b5c;padding:20px}.eyebrow{font-size:12px;letter-spacing:.14em}@media print{body{background:white}main{padding:0}header,section{border-radius:0}article{break-inside:avoid}pre{white-space:pre-wrap}}</style></head><body><main>${parts.join('\n')}</main></body></html>`;
}
