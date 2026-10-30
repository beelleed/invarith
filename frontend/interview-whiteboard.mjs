import {t} from './i18n.mjs';
import {initialBoard,validateBoard,moveBoard,replayBoard} from './interview-board.mjs';
export function initInterviewWhiteboard(root,{onChange,stepMs=1100}){
  const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  root.className='interview-whiteboard';const heading=el('h3',t('Explain it on a whiteboard')),disclosure=el('p',t('Your reasoning sketch · Not Python execution evidence'));
  const mode=el('select');mode.setAttribute('aria-label',t('Whiteboard mode'));for(const[id,label]of [['pointers','Two pointers'],['bfs','BFS queue'],['tree','Tree · DFS stack']]){const option=el('option',t(label));option.value=id;mode.append(option);}
  const values=el('input');values.setAttribute('aria-label',t('Number labels'));values.maxLength=100;
  const edges=el('input');edges.setAttribute('aria-label',t('Connections as JSON index pairs'));edges.maxLength=300;
  const load=el('button',t('Load my example')),reset=el('button',t('Reset illustration')),stage=el('div'),status=el('p'),controls=el('div'),error=el('p');error.setAttribute('role','status');stage.className='interview-board-stage';controls.className='interview-board-controls';
  const notes=el('textarea');notes.maxLength=1000;notes.rows=2;notes.placeholder=t('Explain why you moved this pointer or visited this node.');notes.setAttribute('aria-label',t('Whiteboard reasoning'));
  const history=el('details'),summary=el('summary',t('My reasoning steps · Latest 20')),historyRows=el('div');history.append(summary,historyRows);
  const replayControls=el('div'),previous=el('button',t('Previous saved step')),play=el('button',t('Play saved steps')),next=el('button',t('Next saved step')),latest=el('button',t('Show final saved state')),position=el('p'),seek=el('input'),replayNote=el('small',t('Saved steps are snapshots after your actions. Notes belong to this saved board and are not synchronized to each step.'));
  replayControls.className='board-replay-controls';seek.type='range';seek.setAttribute('aria-label',t('Saved whiteboard step'));position.setAttribute('role','status');replayControls.append(previous,play,next,latest,seek,position,replayNote);
  const config=el('div');config.className='interview-board-controls';config.append(mode,values,edges,load,reset);root.append(heading,disclosure,config,stage,status,controls,replayControls,notes,history,error);
  let board=initialBoard(),editable=false,replayIndex=null,timer=null,sourceLabel='',missing=false;
  function pause(){if(timer!==null)window.clearInterval(timer);timer=null;}
  function jump(index){pause();if(!board.steps.length)return;replayIndex=Math.max(0,Math.min(board.steps.length-1,index));render();}
  function change(next){board=validateBoard(next);onChange(structuredClone(board));render();}
  function act(action,value){if(!editable)return;try{change(moveBoard(board,action,value));error.textContent='';}catch(e){error.textContent=t(e.message);}}
  function button(label,handler){const b=el('button',t(label));b.disabled=!editable;b.addEventListener('click',handler);return b;}
  function render(){
    const view=replayIndex===null?board:replayBoard(board,replayIndex);
    heading.textContent=sourceLabel||t(editable?'Explain it on a whiteboard':'Saved whiteboard');
    disclosure.textContent=t(missing?'No whiteboard was saved for this interview.':'Your reasoning sketch · Not Python execution evidence');for(const element of [config,stage,status,controls,notes,history])element.hidden=missing;
    replayControls.hidden=missing||editable||!board.steps.length;
    const selected=replayIndex??Math.max(0,board.steps.length-1);seek.min='0';seek.max=String(Math.max(0,board.steps.length-1));seek.value=String(selected);previous.disabled=selected===0;next.disabled=selected>=board.steps.length-1;play.textContent=t(timer!==null?'Pause replay':'Play saved steps');
    position.textContent=replayIndex===null?t('Final saved state · {0} retained steps',board.steps.length):t('Saved step {0} / {1}',replayIndex+1,board.steps.length);
    mode.value=view.mode;values.value=view.values.join(', ');edges.value=JSON.stringify(view.edges);edges.hidden=view.mode==='pointers';for(const e of [mode,values,edges,load,reset,notes])e.disabled=!editable;notes.value=view.notes;
    stage.replaceChildren();controls.replaceChildren();
    if(view.mode!=='pointers'){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 260');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
      const positions=view.values.map((_,i)=>({x:300+210*Math.cos(-Math.PI/2+2*Math.PI*i/Math.max(1,view.values.length)),y:130+95*Math.sin(-Math.PI/2+2*Math.PI*i/Math.max(1,view.values.length))}));
      if(view.mode==='tree'&&view.values.length){const levels=[[0]];for(let d=0;d<levels.length;d++){const next=levels[d].flatMap(node=>view.edges.filter(e=>e[0]===node).map(e=>e[1]));if(next.length)levels.push(next);}levels.forEach((level,d)=>level.forEach((node,i)=>{positions[node]={x:600*(i+1)/(level.length+1),y:25+d*210/Math.max(1,levels.length-1)};}));}
      const defs=document.createElementNS(svg.namespaceURI,'defs'),marker=document.createElementNS(svg.namespaceURI,'marker'),tip=document.createElementNS(svg.namespaceURI,'path');marker.id='interview-board-arrow';for(const[k,v]of Object.entries({viewBox:'0 0 10 10',refX:'9',refY:'5',markerWidth:'5',markerHeight:'5',orient:'auto-start-reverse'}))marker.setAttribute(k,v);tip.setAttribute('d','M 0 0 L 10 5 L 0 10 z');marker.append(tip);defs.append(marker);svg.append(defs);
      for(const[from,to]of view.edges){const line=document.createElementNS(svg.namespaceURI,'line');const dx=positions[to].x-positions[from].x,dy=positions[to].y-positions[from].y,distance=Math.hypot(dx,dy)||1;line.setAttribute('x1',positions[from].x+dx*25/distance);line.setAttribute('y1',positions[from].y+dy*25/distance);line.setAttribute('x2',positions[to].x-dx*25/distance);line.setAttribute('y2',positions[to].y-dy*25/distance);line.setAttribute('marker-end','url(#interview-board-arrow)');svg.append(line);}stage.append(svg);
      view.values.forEach((value,i)=>{const node=button(`${value} (#${i})`,()=>act('focus',i));node.className='board-node'+(view.visited.includes(i)?' visited':'')+(view.focus===i?' focused':'');node.style.left=positions[i].x/6+'%';node.style.top=positions[i].y/2.6+'%';stage.append(node);});
      status.textContent=t('Visited: {0} · Frontier: {1}',view.visited.join(', ')||'∅',view.frontier.join(' → ')||'∅');controls.append(button(view.mode==='tree'?'Visit next · Pop stack':'Visit next · Dequeue',()=>act('visit')));
    }else{
      view.values.forEach((value,i)=>{const node=button(`${value} [${i}]${i===view.left?' L':''}${i===view.right?' R':''}`,()=>act('focus',i));node.className='board-cell'+(i===view.focus?' focused':'');stage.append(node);});
      status.textContent=`L=${view.left} · R=${view.right}`;
      for(const[action,delta,label]of [['left',-1,'← Left'],['left',1,'Left →'],['right',-1,'← Right'],['right',1,'Right →']])controls.append(button(label,()=>act(action,board[action]+delta)));
    }
    stage.classList.toggle('graph',view.mode!=='pointers');historyRows.replaceChildren(...view.steps.map((step,i)=>el('p',`${i+1}. ${t(step.action==='visit'?'Visit next':step.action==='focus'?'Focus':step.action==='left'?'Left':'Right')} · L=${step.left} R=${step.right} · ${t('Visited')}: ${step.visited.join(', ')} · ${t('Frontier')}: ${step.frontier.join(', ')}`)));
  }
  mode.addEventListener('change',()=>{if(editable)change(initialBoard(mode.value));});reset.addEventListener('click',()=>{if(editable)change(initialBoard(board.mode));});
  load.addEventListener('click',()=>{if(!editable)return;try{const labels=values.value.trim()?values.value.split(',').map(v=>{if(!v.trim())throw Error('Use up to eight integer labels.');return Number(v.trim());}):[],next={...initialBoard(board.mode),values:labels,edges:board.mode==='pointers'?[]:JSON.parse(edges.value),left:0,right:labels.length-1,frontier:board.mode==='pointers'||!labels.length?[]:[0],visited:[],focus:null,steps:[]};change(next);error.textContent='';}catch(e){error.textContent=t(e.message||'Invalid whiteboard example.');}});
  notes.addEventListener('input',()=>{if(editable){board.notes=notes.value;onChange(structuredClone(board));}});
  previous.addEventListener('click',()=>jump((replayIndex??board.steps.length-1)-1));next.addEventListener('click',()=>jump((replayIndex??board.steps.length-1)+1));
  latest.addEventListener('click',()=>{pause();replayIndex=null;render();});seek.addEventListener('input',()=>jump(Number(seek.value)));
  play.addEventListener('click',()=>{if(editable||!board.steps.length)return;if(timer!==null){pause();render();return;}if(replayIndex===null||replayIndex>=board.steps.length-1)replayIndex=0;timer=window.setInterval(()=>{if(replayIndex>=board.steps.length-1){pause();render();return;}replayIndex++;if(replayIndex===board.steps.length-1)pause();render();},stepMs);render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();render();}});document.addEventListener('workspace-view-changed',event=>{if(event.detail.mode!=='interview'){pause();render();}});window.addEventListener('pagehide',pause,{once:true});
  return {sync(value,enabled,label=''){let incoming;missing=!value&&!enabled;try{incoming=value?validateBoard(value):initialBoard();}catch{incoming=initialBoard();missing=!enabled;}if(JSON.stringify(incoming)!==JSON.stringify(board)||editable!==Boolean(enabled)||sourceLabel!==label){pause();replayIndex=null;}board=incoming;editable=Boolean(enabled);sourceLabel=label;render();},replay(index=0){if(!editable&&board.steps.length)jump(index);},get:()=>structuredClone(board),close:pause};
}
