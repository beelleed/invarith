import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {codeLanguages} from '../frontend/code-languages.mjs';

export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function validateJSONValue(value,depth=0){
 if(depth>64)throw new AppError(400,'JSON values must not be nested more than 64 levels.');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value))throw new AppError(400,'Use finite JSON numbers; integers must be within the safe JSON range. Use strings for larger integers.');return;}
 if(Array.isArray(value)){for(const child of value)validateJSONValue(child,depth+1);return;}
 if(value&&typeof value==='object'){for(const child of Object.values(value))validateJSONValue(child,depth+1);return;}
 throw new AppError(400,'Inputs and return values must be JSON-compatible.');
}

export function validateSubmission(body) {
  if (!body || typeof body !== 'object') throw new AppError(400, 'Provide code and test cases.');
  if (typeof body.code !== 'string' || !body.code.trim() || body.code.length > 24000) throw new AppError(400, 'Code must not be empty and must not exceed 24,000 characters.');
  if (typeof body.functionName !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(body.functionName)) throw new AppError(400, 'Enter a valid function name.');
  const codeLanguage=body.codeLanguage||'python';
  if(!codeLanguages.some(item=>item.id===codeLanguage))throw new AppError(400,'Choose a supported programming language.');
  if (body.intent !== undefined && (typeof body.intent !== 'string' || body.intent.length > 4000)) throw new AppError(400, 'Intended behavior must be text with at most 4,000 characters.');
  if (!Array.isArray(body.cases) || body.cases.length < 1 || body.cases.length > 20) throw new AppError(400, 'Provide between 1 and 20 test cases.');
  for (const item of body.cases) {
    if (!item || !Array.isArray(item.args) || !Object.hasOwn(item, 'expected')) throw new AppError(400, 'Each case must have an args array and an expected value.');
    if (item.kwargs !== undefined && (!item.kwargs || typeof item.kwargs !== 'object' || Array.isArray(item.kwargs))) throw new AppError(400, 'kwargs must be a JSON object.');
    if(codeLanguage!=='python'&&Object.keys(item.kwargs||{}).length)throw new AppError(400,'Use positional arguments for this programming language.');
  }
  return { code: body.code, functionName: body.functionName, cases: body.cases, ...(codeLanguage!=='python'?{codeLanguage}:{}), ...(body.intent !== undefined ? { intent: body.intent } : {}) };
}

export async function polyglotHealth(){try{const result=await command('docker',['image','inspect',process.env.POLYGLOT_IMAGE||'invarith-polyglot:2','--format','{{.Id}}']);return {ready:result.code===0,languages:codeLanguages.map(row=>row.id)};}catch{return {ready:false,languages:['python']};}}

async function verifyPolyglot(submission){
 for(const item of submission.cases){validateJSONValue(item.args);validateJSONValue(item.expected);}
 const ready=await polyglotHealth();if(!ready.ready)throw new AppError(503,'The selected language runner is not ready. Ask the workspace administrator to install it.');
 const name='invarith-'+randomUUID(),started=Date.now(),source=(await readFile(new URL('./polyglot/harnesses.py',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('./polyglot/runner.py',import.meta.url),'utf8'));
 try{
  const result=await command('docker',['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--memory=768m','--memory-swap=768m','--cpus=1','--pids-limit=96','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--tmpfs=/tmp:rw,exec,nosuid,size=256m','--log-driver=none','-i',process.env.POLYGLOT_IMAGE||'invarith-polyglot:2','python3','-I','-B','-u','-c',source],{input:JSON.stringify(submission),timeout:75000});
  if(result.code!==0)throw new AppError(422,'The language worker did not complete. It may have exceeded resource limits.');
  let data;try{data=JSON.parse(result.stdout);}catch{throw new AppError(422,'Invalid language execution response.');}
  if(!Array.isArray(data.results)||data.results.length!==submission.cases.length)throw new AppError(422,'Incomplete language execution response.');
  const results=data.results.map((row,index)=>{if(row.index!==index||!['passed','failed','error'].includes(row.status))throw new AppError(422,'Invalid language execution evidence.');if(row.status!=='error')try{validateJSONValue(row.actual);}catch(error){return {...row,actual:undefined,status:'error',error:error.message};}return {...row,status:row.status==='error'?'error':isDeepStrictEqual(row.actual,submission.cases[index].expected)?'passed':'failed'};});
  return {id:randomUUID(),createdAt:new Date().toISOString(),durationMs:Date.now()-started,results,codeLanguage:submission.codeLanguage,execution:'docker-'+submission.codeLanguage,passed:results.filter(row=>row.status==='passed').length,total:results.length,security:{status:'not_scanned',source:'static_analysis',findings:[],reason:'Static security review is currently available for Python only.'}};
 }finally{await command('docker',['rm','-f',name],{timeout:5000}).catch(()=>{});}
}

export function command(file, args, { input, timeout = 5000, maxOutput = 256000, unavailableMessage='Docker was not found. Install and start Docker Desktop.', timeoutMessage='The time limit was exceeded. The job has been stopped.' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let stdout = '', stderr = '', size = 0, failure;
    const timer = setTimeout(() => { failure = new AppError(408, timeoutMessage); child.kill(); }, timeout);
    for (const [stream, key] of [[child.stdout, 'out'], [child.stderr, 'err']]) {
      stream.on('data', chunk => {
        size += Buffer.byteLength(chunk);
        if (size > maxOutput) { failure = new AppError(422, 'The output limit was exceeded. The job has been stopped.'); child.kill(); return; }
        if (key === 'out') stdout += chunk.toString(); else stderr += chunk.toString();
      });
    }
    child.on('error', () => { clearTimeout(timer); reject(new AppError(503, unavailableMessage)); });
    child.on('close', code => { clearTimeout(timer); if (failure) reject(failure); else resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

export async function runnerHealth() {
  const image = process.env.PYTHON_IMAGE || 'python:3.12-alpine';
  try {
    const engine = await command('docker', ['info', '--format', '{{.OSType}}']);
    if (engine.code !== 0) return { ready: false, message: 'Start Docker Desktop, then check again.' };
    if (engine.stdout.trim() !== 'linux') return { ready: false, message: 'Switch Docker Desktop to Linux containers.' };
    const result = await command('docker', ['image', 'inspect', image, '--format', '{{.Id}}']);
    return result.code === 0 ? { ready: true, message: 'Isolated Python runner is ready' } : { ready: false, message: `Python image is missing. Run docker pull ${image}` };
  } catch (error) { return { ready: false, message: error.status === 408 ? 'Docker timed out. Check that Docker Desktop is running.' : error.message }; }
}

export async function verify(submission) {
  if(submission.codeLanguage&&submission.codeLanguage!=='python')return verifyPolyglot(submission);
  const health = await runnerHealth();
  if (!health.ready) throw new AppError(503, health.message);
  const name = `invarith-${randomUUID()}`;
  const source = await readFile(new URL('./runner.py', import.meta.url), 'utf8');
  const started = Date.now();
  try {
    const result = await command('docker', [
      'run', '--rm', '--pull=never', '--name', name, '--network=none', '--read-only',
      '--memory=128m', '--memory-swap=128m', '--cpus=0.5', '--pids-limit=32',
      '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=65534:65534',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=8m', '--log-driver=none', '-i',
      process.env.PYTHON_IMAGE || 'python:3.12-alpine', 'python', '-I', '-B', '-u', '-c', source,
    ], { input: JSON.stringify(submission), timeout: 10000 });
    if (result.code !== 0) throw new AppError(422, 'The Python job did not complete. It may have exceeded resource limits or exited early.');
    let data;
    try { data = JSON.parse(result.stdout); } catch { throw new AppError(422, 'Invalid execution response. Verification evidence could not be recorded.'); }
    if (!Array.isArray(data.results) || data.results.length !== submission.cases.length || data.results.some((row, i) => row.index !== i || !['passed', 'failed', 'error'].includes(row.status))) throw new AppError(422, 'Incomplete execution response. Verification evidence could not be recorded.');
    const security = submission.files?{status:'not_scanned',source:'static_analysis',findings:[],reason:'Static security review was not run for the multi-file workspace.'}:await securityReview(submission.code).catch(error => ({ status: 'unavailable', source: 'static_analysis', findings: [], reason: error.message }));
    return { id: randomUUID(), createdAt: new Date().toISOString(), durationMs: Date.now() - started, results: data.results, execution: 'docker-python', passed: data.results.filter(r => r.status === 'passed').length, total: data.results.length, security };
  } finally {
    // Killing the CLI does not guarantee the container stopped. Always remove our named worker.
    await command('docker', ['rm', '-f', name], { timeout: 5000 }).catch(() => {});
  }
}

export async function securityReview(code) {
  if (typeof code !== 'string' || !code.trim() || code.length > 24000) throw new AppError(400, 'Provide Python source with at most 24,000 characters.');
  const source = await readFile(new URL('./security_scan.py', import.meta.url), 'utf8');
  const name = `invarith-review-${randomUUID()}`;
  try {
    const result = await command('docker', ['run','--rm','--pull=never','--name',name,'--network=none','--read-only','--memory=128m','--memory-swap=128m','--cpus=0.5','--pids-limit=32','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534','--log-driver=none','-i',process.env.PYTHON_IMAGE || 'python:3.12-alpine','python','-I','-B','-c',source], { input: JSON.stringify({code}), timeout: 6000 });
    if (result.code !== 0) throw new AppError(503, 'Static review did not complete. Check the Python execution environment.');
    let report; try { report = JSON.parse(result.stdout); } catch { throw new AppError(503, 'Static review returned an unreadable response.'); }
    if (!['completed','not_scanned'].includes(report.status) || !Array.isArray(report.findings)) throw new AppError(503, 'Static review returned an incomplete response.');
    return {...report,execution:'docker-python'};
  } finally { await command('docker',['rm','-f',name],{timeout:5000}).catch(()=>{}); }
}
