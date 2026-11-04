import {questionPanelItems,editorPanelItems} from './practice-panels.mjs';
export const practiceResumeKey=locale=>'invarith-last-practice:'+locale;
const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export function readPracticeResume(storage,locale){
  try{const value=JSON.parse(storage.getItem(practiceResumeKey(locale)));if(!value||!validId(value.id))return null;return {id:value.id,questionPanel:questionPanelItems.some(([id])=>id===value.questionPanel)?value.questionPanel:'question',editorPanel:editorPanelItems.some(([id])=>id===value.editorPanel)?value.editorPanel:'results'};}catch{return null;}
}
export function writePracticeResume(storage,locale,value){
  if(!validId(value?.id))return false;try{storage.setItem(practiceResumeKey(locale),JSON.stringify({id:value.id,questionPanel:questionPanelItems.some(([id])=>id===value.questionPanel)?value.questionPanel:'question',editorPanel:editorPanelItems.some(([id])=>id===value.editorPanel)?value.editorPanel:'results'}));return true;}catch{return false;}
}
export function forgetPracticeResume(storage,locale,id){
  try{if(readPracticeResume(storage,locale)?.id===id)storage.removeItem(practiceResumeKey(locale));}catch{}
}
