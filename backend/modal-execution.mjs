import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { command, AppError } from './verification.mjs';
export function executionChoice(value){if(value===undefined)return 'docker';if(!['docker','modal'].includes(value))throw new AppError(400,'Choose docker or modal as the execution environment.');return value;}

export async function callModal(payload, invoke=command) {
  const python=process.env.MODAL_PYTHON || fileURLToPath(new URL(process.platform==='win32'?'../.venv/Scripts/python.exe':'../.venv/bin/python',import.meta.url));
  const result=await invoke(python,[fileURLToPath(new URL('./modal_bridge.py',import.meta.url))],{input:JSON.stringify(payload),timeout:payload.mode==='health'?8000:150000,maxOutput:320000,unavailableMessage:'Modal Python environment is missing. Install requirements-modal.txt into .venv.',timeoutMessage:'Modal request timed out. Remote lifetime is capped at 30 seconds after startup; no Docker fallback was attempted.'});
  let message;try{message=JSON.parse(result.stdout);}catch{throw new AppError(503,'Modal returned an unreadable response. No local fallback was used.');}
  if(result.code!==0 || !message.ok)throw new AppError(503,message.error || 'Modal execution failed. No local fallback was used.');
  return message.data;
}

export async function modalHealth() {try{return await callModal({mode:'health'});}catch(error){return {ready:false,message:error.message,execution:'modal-python'};}}

export function validateModalResults(data,submission){
  if(!Array.isArray(data.results) || data.results.length!==submission.cases.length || data.results.some((row,index)=>row.index!==index || !['passed','failed','error'].includes(row.status)))throw new AppError(422,'Incomplete Modal execution evidence. No local fallback was used.');
  return data;
}

export async function verifyModal(submission, invoke=callModal){
  const started=Date.now(),data=validateModalResults(await invoke({mode:'verify',submission}),submission);
  return {id:randomUUID(),createdAt:new Date().toISOString(),durationMs:Date.now()-started,results:data.results,passed:data.results.filter(row=>row.status==='passed').length,total:data.results.length,security:data.security?{...data.security,execution:'modal-python'}:{status:'unavailable',findings:[],reason:'Cloud static review was not recorded.'},execution:'modal-python',cloud:{provider:'Modal',sandboxId:data.sandboxId,network:'outbound blocked',lifetimeSeconds:30,executionTimeoutSeconds:10,cpuRequest:0.125,cpuLimit:0.5,memoryRequestMiB:128,memoryLimitMiB:256}};
}

export async function securityReviewModal(code){const data=await callModal({mode:'security',submission:{code}});return {...data.security,execution:'modal-python'};}
