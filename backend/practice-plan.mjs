import {AppError} from './verification.mjs';
export const planFields=['understanding','approach','invariant','boundaries','time','space'];
export const emptyPlan=()=>({revision:0,updatedAt:null,...Object.fromEntries(planFields.map(key=>[key,'']))});
export function validatePlanFields(value){
  if(!value||planFields.some(key=>typeof value[key]!=='string'||value[key].length>2000))throw new AppError(400,'Keep each solution-plan field within 2,000 characters.');
  return Object.fromEntries(planFields.map(key=>[key,value[key]]));
}
export function validSavedPlan(value){
  try{validatePlanFields(value);return Number.isSafeInteger(value.revision)&&value.revision>=0&&typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt));}catch{return false;}
}
