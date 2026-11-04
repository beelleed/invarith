export const solutionPlanFields=['understanding','approach','invariant','boundaries','time','space'];
export const solutionPlanLabels={understanding:'What must the function do?',approach:'Which approach will I use, and why?',invariant:'What stays true as the algorithm runs?',boundaries:'Which boundary cases will I test?',time:'Time complexity and why',space:'Extra space and why'};
export function solutionPlanValues(value={}){return Object.fromEntries(solutionPlanFields.map(key=>[key,typeof value[key]==='string'?value[key]:'']));}
export function validSolutionPlanDraft(value){return value&&Number.isSafeInteger(value.revision)&&value.revision>=0&&value.fields&&solutionPlanFields.every(key=>typeof value.fields[key]==='string'&&value.fields[key].length<=2000);}
export function sameSolutionPlan(left,right){return solutionPlanFields.every(key=>left[key]===right[key]);}
export function solutionPlanOutline(value){return solutionPlanFields.filter(key=>value[key]?.trim()).map(key=>({key,text:value[key].trim()}));}
