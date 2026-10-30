import { t } from './i18n.mjs';
const c={background:'#101c29',panel:'#172637',text:'#ecf3fd',muted:'#9db0c5',green:'#7fe3bb',yellow:'#ffda82',red:'#ff9292',blue:'#8fbdff'};
function text(ctx,value,x,y,size=24,color=c.text){ctx.fillStyle=color;ctx.font=`${size>=28?'600':'400'} ${size}px system-ui, sans-serif`;ctx.fillText(String(value),x,y);}
function lines(ctx,value,x,y,width,size=24,max=4){
  const content=String(value),cjk=/[\u3400-\u9fff]/.test(content);
  const words=cjk?Array.from(content):content.split(/\s+/),separator=cjk?'':' ';
  let line='',offset=0;ctx.font=`${size}px system-ui, sans-serif`;
  for(const word of words){const candidate=line+(line?separator:'')+word;if(ctx.measureText(candidate).width>width && line){text(ctx,line,x,y+offset*size*1.5,size);line=word;offset++;if(offset>=max)return;}else line=candidate;}
  if(line)text(ctx,line,x,y+offset*size*1.5,size);
}
function box(ctx,x,y,w,h,color=c.panel){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();}
function arrow(ctx,x,y,toX,toY,label,color=c.yellow){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();const angle=Math.atan2(toY-y,toX-x);ctx.beginPath();ctx.moveTo(toX,toY);ctx.lineTo(toX-13*Math.cos(angle-.5),toY-13*Math.sin(angle-.5));ctx.moveTo(toX,toY);ctx.lineTo(toX-13*Math.cos(angle+.5),toY-13*Math.sin(angle+.5));ctx.stroke();if(label)text(ctx,label,x-22,y-13,21,color);}
function array(ctx,s,time){
  const values=s.values,spacing=Math.min(140,640/Math.max(1,values.length)),start=105+(650-spacing*values.length)/2;text(ctx,t("Find {0}", s.target ?? 5),75,197,29,c.blue);
  if(!values.length){text(ctx,'[ ]',335,335,64,c.yellow);text(ctx,t("No positions to inspect"),205,405,25);return;}
  values.forEach((value,i)=>{const x=start+i*spacing,valid=i>=s.left && i<=s.right;box(ctx,x,280,spacing-16,94,s.focus===i?'#35584c':valid?'#243d55':'#182633');text(ctx,value,x+36,341,36,valid?c.text:'#63768a');text(ctx,t("index {0}", i),x+15,402,17,c.muted);if(!valid){ctx.strokeStyle=c.red;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+9,291);ctx.lineTo(x+spacing-25,364);ctx.stroke();}});
  const center=i=>start+i*spacing+(spacing-16)/2;
  if(s.left===s.right && s.left>=0)arrow(ctx,center(s.left),220,center(s.left),269,t('L = R'));else{if(s.left>=0)arrow(ctx,center(s.left),220,center(s.left),269,t('left'),c.green);if(s.right>=0)arrow(ctx,center(s.right),220,center(s.right),269,t('right'),c.blue);}
  if(Number.isInteger(s.mid))arrow(ctx,center(s.mid),470,center(s.mid),414,t('mid'));
  if(Number.isInteger(s.focus)){ctx.strokeStyle=c.yellow;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(center(s.focus),327,(spacing-10)/2,57,0,0,Math.PI*2*Math.min(1,.3+time));ctx.stroke();}
}
function sharing(ctx,s){
  text(ctx,t("Keep the total. Share it equally."),75,195,27,c.blue);const values=s.balanced?s.values.map(()=>4):s.values;
  if(!values.length){text(ctx,t("No recipients"),220,307,40,c.yellow);text(ctx,t("count = 0"),285,373,30);return;}
  values.forEach((value,i)=>{const x=135+i*190;box(ctx,x,245,150,195,'#22394b');text(ctx,t("Group {0}", i+1),x+23,471,18,c.muted);if(value>=0 && value<=12)for(let j=0;j<value;j++){ctx.fillStyle=s.balanced?c.green:[c.blue,c.yellow,c.green][i%3];ctx.beginPath();ctx.arc(x+32+(j%3)*42,405-Math.floor(j/3)*45,12,0,Math.PI*2);ctx.fill();}text(ctx,value,x+59,281,28);});
  if(s.balanced){arrow(ctx,257,330,311,330,'',c.green);arrow(ctx,505,330,454,330,'',c.green);}
}
function threshold(ctx,s){
  text(ctx,t("Order total → delivery fee"),75,198,29,c.blue);const x=[160,390,620];ctx.strokeStyle=c.muted;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(95,332);ctx.lineTo(720,332);ctx.stroke();
  if(s.inclusive){ctx.strokeStyle=c.green;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(x[1],332);ctx.lineTo(720,332);ctx.stroke();}
  [499,500,501].forEach((value,i)=>{const paid=i===0 || (value===500 && !s.inclusive),color=paid?c.red:c.green;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x[i],332,13,0,Math.PI*2);ctx.fill();text(ctx,value,x[i]-33,393,29);text(ctx,paid?t("fee 60"):t("fee 0"),x[i]-42,448,24,color);if(s.focus===value)arrow(ctx,x[i],249,x[i],305,t("Check"));});
}
function code(ctx,deck,s,motion=1){const values=(s.generated?s.code:s.repaired?deck.context.repairCode:deck.context.code).split('\n'),size=values.length>12?18:values.length>8?21:26;text(ctx,s.generated?t('Build the solution'):s.repaired?t("Reasoned repair"):t("Original implementation"),75,196,26,s.repaired?c.green:c.red);values.slice(0,14).forEach((line,i)=>{const y=240+i*(size+6);if(i+1===s.line)box(ctx,63,y-size-4,680,size+12,'#3c493a');text(ctx,i+1,78,y,size-4,c.muted);text(ctx,s.generated&&i===values.length-1?line.slice(0,Math.ceil(line.length*motion)):line,116,y,size);});}
function evidence(ctx,frame){const p=frame.teaching.evidence;if(!p)return;text(ctx,t("SAME EXPECTATIONS · ACTUAL RUNS"),75,195,22,c.blue);p.cases.forEach((item,i)=>{const y=225+i*88,b=p.before.results[i],a=p.after.results[i];box(ctx,66,y,680,72);text(ctx,`${p.functionName}(${item.args.map(value=>JSON.stringify(value)).join(', ')})`,82,y+28,20);text(ctx,t("Expected {0}", JSON.stringify(item.expected)),82,y+54,17,c.muted);text(ctx,b.status==='passed'?t("Passed"):b.status==='error'?t("Error"):t("Mismatch"),430,y+43,21,b.status==='passed'?c.green:c.red);text(ctx,'→',552,y+43,24);text(ctx,a.status==='passed'?t("Passed"):a.status,606,y+43,21,c.green);});text(ctx,t("After: {0}/{1} supplied cases passed", p.after.passed, p.after.total),80,535,22,c.green);}
export function graphPositions(scene){
  if(scene.type!=='tree')return scene.values.map((_,i)=>({x:410+240*Math.cos(-Math.PI/2+i*2*Math.PI/scene.values.length),y:345+125*Math.sin(-Math.PI/2+i*2*Math.PI/scene.values.length)}));
  const levels=[[0]],positions=[];
  for(let depth=0;depth<levels.length;depth++){
    const level=levels[depth];
    const next=level.flatMap(node=>scene.edges.filter(e=>e.from===node).map(e=>e.to));if(next.length)levels.push(next);
  }
  levels.forEach((level,depth)=>level.forEach((node,i)=>{positions[node]={x:95+(i+1)*620/(level.length+1),y:220+depth*Math.min(65,260/Math.max(1,levels.length-1))};}));
  return positions;
}
export function treeMetrics(scene){
  const children=scene.values.map((_,i)=>scene.edges.filter(e=>e.from===i).map(e=>e.to)),heights=[];
  function height(node){const values=children[node].map(height);heights[node]=1+Math.max(0,...values);return heights[node];}
  height(0);
  return heights.map((value,i)=>{const childHeights=children[i].map(child=>heights[child]);while(childHeights.length<2)childHeights.push(0);return {height:value,childHeights,difference:Math.abs(childHeights[0]-childHeights[1])};});
}
function graph(ctx,s,motion,previous){
  const positions=graphPositions(s),visited=new Set(s.visited),frontier=new Set(s.frontier),metrics=s.type==='tree'?treeMetrics(s):null;
  for(const edge of s.edges){
    const a=positions[edge.from],b=positions[edge.to],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
    const start={x:a.x+dx*26/d,y:a.y+dy*26/d},end={x:b.x-dx*30/d,y:b.y-dy*30/d};
    const active=previous?.focus===edge.from&&s.focus===edge.to||!s.directed&&previous?.focus===edge.to&&s.focus===edge.from;
    const color=active?c.yellow:c.muted;
    if(s.directed)arrow(ctx,start.x,start.y,end.x,end.y,'',color);else{ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();}
    if(active&&motion<1){const progress=previous.focus===edge.from?motion:1-motion;ctx.fillStyle=c.yellow;ctx.beginPath();ctx.arc(start.x+(end.x-start.x)*progress,start.y+(end.y-start.y)*progress,7,0,Math.PI*2);ctx.fill();}
  }
  s.values.forEach((value,i)=>{const p=positions[i],focus=s.focus===i;ctx.fillStyle=focus?'#655130':visited.has(i)?'#245642':frontier.has(i)?'#29486b':c.panel;ctx.strokeStyle=focus?c.yellow:visited.has(i)?c.green:frontier.has(i)?c.blue:c.muted;ctx.lineWidth=focus?4:2;ctx.beginPath();ctx.arc(p.x,p.y,25,0,Math.PI*2);ctx.fill();ctx.stroke();text(ctx,value,p.x-9,p.y+8,23);text(ctx,metrics?`#${i} · h=${metrics[i].height}`:`#${i}`,p.x-24,p.y+43,13,c.muted);});
  text(ctx,t('Visited')+': '+s.visited.map(i=>`${s.values[i]} (#${i})`).join(', '),75,532,17,c.green);
  text(ctx,t('Frontier')+': '+(s.frontier.map(i=>`${s.values[i]} (#${i})`).join(' → ')||'∅'),75,566,17,c.blue);
}
export function drawTeacherScene(canvas,deck,index,{step=0,motion=1}={}){
  const ctx=canvas.getContext('2d'),frame=deck.frames[index],cues=frame.teaching.cues,current=cues[Math.min(step,cues.length-1)],scene=current.scene;
  ctx.fillStyle=c.background;ctx.fillRect(0,0,1280,720);text(ctx,t("INVARITH / THINK IT THROUGH"),38,42,21,c.green);text(ctx,t("CHAPTER {0} OF {1}   ·   {2}", index+1, deck.frames.length, frame.checkpoint?t('YOUR TURN'):t('GUIDED EXPLANATION')),38,78,16,c.muted);text(ctx,frame.title,38,128,31);box(ctx,38,151,740,440,'#142333');box(ctx,800,151,442,440);
  if(['tree','graph'].includes(scene.type))graph(ctx,scene,motion,cues[Math.max(0,step-1)]?.scene);else if(scene.type==='array')array(ctx,scene,motion);else if(scene.type==='sharing')sharing(ctx,scene);else if(scene.type==='threshold')threshold(ctx,scene);else if(scene.type==='code')code(ctx,deck,scene,motion);else if(scene.type==='board'){lines(ctx,scene.annotation,80,235,640,30,7);}else evidence(ctx,frame);
  text(ctx,t("THE REASONING"),826,195,18,c.yellow);lines(ctx,current.note,826,238,385,27,5);
  if(scene.type==='tree'){
    const node=scene.focus??0,facts=treeMetrics(scene)[node];
    box(ctx,816,400,410,160,'#233b45');
    lines(ctx,t('Node {0}: height {1}',scene.values[node],facts.height),836,430,365,22,2);
    lines(ctx,t('Child heights {0}, {1} · difference {2}',...facts.childHeights,facts.difference),836,475,365,19,2);
    text(ctx,t('Height = 1 + max(child heights)'),836,541,17,c.green);
  }else if(scene.equation){box(ctx,816,400,410,150,'#233b45');lines(ctx,scene.equation,836,437,365,24,3);}else if(scene.annotation)lines(ctx,scene.annotation,826,435,375,22,4);
  box(ctx,38,612,1204,54,'#213748');text(ctx,t("IDEA {0}/{1}", step+1, cues.length),55,646,17,c.green);text(ctx,scene.type==='evidence'?t("Recorded execution results; supplied inputs only."):deck.generated?t('AI solution illustration · Not execution evidence'):t("Concept illustration — reasoning, not an execution trace."),210,646,19);text(ctx,scene.type==='evidence'?t("Before {0} · After {1}", frame.teaching.observed.beforeSource, frame.teaching.observed.afterSource):t("Pause, explain the idea in your own words, then continue."),38,695,14,c.muted);
}
