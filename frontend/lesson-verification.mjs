// Import a proposal as a fresh task; lesson illustrations never become test oracles.
export function lessonVerificationDraft(lesson){
  if(!lesson||typeof lesson.code!=='string'||!lesson.code.trim()||lesson.code.length>24000||typeof lesson.problem!=='string'||!lesson.problem.trim()||lesson.problem.length>4000)throw new Error('This lesson has no importable Python solution.');
  const functions=[...lesson.code.matchAll(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map(match=>match[1]);
  if(!functions.length)throw new Error('This lesson has no supported Python function.');
  return {code:lesson.code,intent:lesson.problem,functionName:functions[0],cases:[]};
}
export function captureEditorDraft(document){return {code:document.getElementById('code').value,intent:document.getElementById('intent').value,functionName:document.getElementById('function-name').value,cases:document.getElementById('cases').value};}
export function restoreEditorDraft(document,draft){
  for(const [key,id] of Object.entries({code:'code',intent:'intent',functionName:'function-name',cases:'cases'})){
    if(typeof draft?.[key]!=='string')throw new Error('The previous draft cannot be restored.');
  }
  document.getElementById('code').value=draft.code;document.getElementById('intent').value=draft.intent;document.getElementById('function-name').value=draft.functionName;document.getElementById('cases').value=draft.cases;
}
