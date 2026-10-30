const modes=['pointers','bfs','tree'];
export function initialBoard(mode='pointers'){
  const graph=mode!=='pointers';return {version:1,mode,values:graph?[0,1,2,3,4]:[1,2,4,6,9],edges:graph?[[0,1],[0,2],[1,3],[1,4]]:[],left:0,right:4,focus:null,frontier:graph?[0]:[],visited:[],notes:'',steps:[]};
}
export function validateBoard(input){
  if(!input||input.version!==1||!modes.includes(input.mode)||!Array.isArray(input.values)||input.values.length>8||input.values.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1000000))throw Error('Use up to eight integer labels.');
  const n=input.values.length,index=v=>Number.isInteger(v)&&v>=0&&v<n;
  if(!Number.isInteger(input.left)||input.left<0||input.left>n||!Number.isInteger(input.right)||input.right< -1||input.right>=n||input.focus!==null&&!index(input.focus))throw Error('Invalid whiteboard position.');
  if(!Array.isArray(input.edges)||input.edges.length>20||input.edges.some(e=>!Array.isArray(e)||e.length!==2||!e.every(index))||new Set(input.edges.map(e=>e.join(','))).size!==input.edges.length)throw Error('Use valid, distinct node connections.');
  for(const key of ['frontier','visited'])if(!Array.isArray(input[key])||input[key].length>8||input[key].some(v=>!index(v))||new Set(input[key]).size!==input[key].length)throw Error('Invalid whiteboard queue or visited set.');
  if(typeof input.notes!=='string'||input.notes.length>1000||!Array.isArray(input.steps)||input.steps.length>20)throw Error('Whiteboard notes or steps are too long.');
  if(input.mode==='tree'&&n){const parents=Array(n).fill(0);for(const[a,b]of input.edges){parents[b]++;if(input.edges.filter(e=>e[0]===a).length>2)throw Error('A binary tree has at most two children per node.');}if(parents[0]!==0||parents.slice(1).some(c=>c!==1)||input.edges.length!==n-1)throw Error('Use a tree rooted at node 0.');const seen=new Set([0]),q=[0];for(const a of q)for(const[,b]of input.edges.filter(e=>e[0]===a)){if(seen.has(b))throw Error('Use a tree without cycles.');seen.add(b);q.push(b);}if(seen.size!==n)throw Error('Connect every tree node to root 0.');}
  const state={version:1,mode:input.mode,values:[...input.values],edges:input.edges.map(e=>[...e]),left:input.left,right:input.right,focus:input.focus,frontier:[...input.frontier],visited:[...input.visited],notes:input.notes,steps:[]};
  for(const step of input.steps){if(!step||!['left','right','visit','focus'].includes(step.action)||!Number.isInteger(step.left)||!Number.isInteger(step.right)||step.left<0||step.left>n||step.right< -1||step.right>=n||step.focus!==null&&!index(step.focus)||!Array.isArray(step.frontier)||!Array.isArray(step.visited)||step.frontier.length>8||step.visited.length>8||step.frontier.some(v=>!index(v))||step.visited.some(v=>!index(v)))throw Error('Invalid saved whiteboard step.');state.steps.push({action:step.action,left:step.left,right:step.right,focus:step.focus,frontier:[...step.frontier],visited:[...step.visited]});}
  return state;
}
export function moveBoard(input,action,value){
  const board=validateBoard(input),n=board.values.length;
  if(action==='left')board.left=Math.max(0,Math.min(n,value));
  else if(action==='right')board.right=Math.max(-1,Math.min(n-1,value));
  else if(action==='focus')board.focus=value;
  else if(action==='visit'){
    if(!board.frontier.length)return board;
    const node=board.mode==='tree'?board.frontier.pop():board.frontier.shift();board.focus=node;
    if(!board.visited.includes(node))board.visited.push(node);
    let children=board.edges.filter(e=>e[0]===node).map(e=>e[1]);if(board.mode==='tree')children=children.reverse();
    for(const next of children)if(!board.visited.includes(next)&&!board.frontier.includes(next))board.frontier.push(next);
  }else throw Error('Choose a whiteboard action.');
  board.steps.push({action,left:board.left,right:board.right,focus:board.focus,frontier:[...board.frontier],visited:[...board.visited]});board.steps=board.steps.slice(-20);
  return validateBoard(board);
}
export function replayBoard(input,index){
  const board=validateBoard(input);
  if(!Number.isInteger(index)||index<0||index>=board.steps.length)throw Error('Choose a saved whiteboard step.');
  const step=board.steps[index];
  // Each saved step is a post-action snapshot. Do not invent an initial state:
  // earlier steps may have been trimmed from the bounded history.
  return {...board,left:step.left,right:step.right,focus:step.focus,frontier:[...step.frontier],visited:[...step.visited]};
}
