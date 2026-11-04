export const questionPanelItems=[['question','Question'],['plan','Plan'],['notes','Notes'],['options','Practice options']];
export const editorPanelItems=[['results','Results'],['tests','My tests'],['debug','Debug journal'],['explain','Explain aloud'],['versions','Versions'],['assistant','AI assistant']];
export function practiceEditorAction(event){return (event.ctrlKey||event.metaKey)&&!event.altKey&&event.key==='Enter'?(event.shiftKey?'submit':'examples'):null;}
export function nextPracticePanel(items,current,key){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(key)||!items.length)return null;
  const index=Math.max(0,items.findIndex(([id])=>id===current));
  return items[key==='Home'?0:key==='End'?items.length-1:(index+(key==='ArrowRight'?1:-1)+items.length)%items.length][0];
}
