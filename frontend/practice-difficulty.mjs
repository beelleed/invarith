// Invarith editorial estimates for solving the coding contract, not official
// LeetCode labels or a measurement of a learner's skill. Neither core/extension
// nor larger random inputs imply a higher difficulty.
export const difficultyRatings={
  hash:['easy','easy'],strings:['easy','medium'],sliding:['medium','medium'],
  prefix:['medium','medium'],stack:['easy','easy'],monotonic:['medium','medium','hard'],
  heap:['medium','easy'],intervals:['medium','medium'],greedy:['medium','medium'],
  dp:['medium','medium','hard'],backtracking:['medium','medium'],tree:['easy','easy'],
  linked:['easy','medium'],union:['medium','medium'],topo:['medium','medium'],
  bfs:['medium','easy','hard'],dfs:['easy','easy'],binary:['easy','medium'],
  pointers:['easy','easy'],bits:['easy','easy'],trie:['medium','easy'],
  math:['easy','easy'],matrix:['medium','easy'],sorting:['easy','easy'],
  shortest:['medium','medium'],divide:['medium','medium'],queue:['easy','easy'],
  segment:['medium','medium'],design:['medium','easy'],geometry:['easy','easy'],
};
export function practiceDifficulty(taskId){
  if(typeof taskId!=='string')return null;
  const [family,variant,...rest]=taskId.split(':');
  if(rest.length||variant!==undefined&&!['extended','challenge'].includes(variant))return null;
  return difficultyRatings[family]?.[variant==='challenge'?2:variant==='extended'?1:0]||null;
}
export function practiceLevels(family){return difficultyRatings[family]?['standard','extended','challenge'].slice(0,difficultyRatings[family].length):[];}
export function practiceTaskId(family,level){return family+(level==='standard'?'':':'+level);}
export function availableDifficulties(family,mode='coding',level='mixed'){
  if(!difficultyRatings[family]||!['coding','debug','optimize'].includes(mode)||!['mixed','standard','extended','challenge'].includes(level))return [];
  if(mode==='optimize'&&!['bfs','dfs','binary','pointers'].includes(family))return [];
  const levels=mode==='optimize'?['standard']:level==='mixed'?practiceLevels(family):[level];
  return ['easy','medium','hard'].filter(value=>levels.some(item=>practiceDifficulty(practiceTaskId(family,item))===value));
}
