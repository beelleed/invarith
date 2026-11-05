// One component per row keeps diagrams readable as the board grows.
export function wrapArchitectureLabel(label,limit=40){
 const lines=[];let line='',width=0;const size=text=>[...text].reduce((n,c)=>n+(c.codePointAt(0)>255?2:1),0);
 for(const word of String(label).trim().split(/\s+/)){
  if(line&&width+1+size(word)>limit){lines.push(line);line='';width=0;}
  for(const char of word){const next=size(char);if(width+next>limit){lines.push(line);line='';width=0;}if(!line)line=char;else line+=char;width+=next;}
  if(width<limit){line+=' ';width++;}
 }
 if(line.trim())lines.push(line.trim());return lines.length?lines.map(s=>s.trim()):[''];
}
export function layoutArchitecture(board){
 const index=new Map(board.nodes.map((n,i)=>[n.id,i])),valid=board.edges.filter(e=>index.has(e.from)&&index.has(e.to)&&e.from!==e.to);
 const left=valid.filter(e=>index.get(e.to)<index.get(e.from)),right=valid.filter(e=>index.get(e.to)>index.get(e.from)+1),laneGap=24,nodeWidth=340,padding=36;
 const nodeX=padding+Math.max(48,left.length*laneGap),width=Math.max(520,nodeX+nodeWidth+padding+Math.max(48,right.length*laneGap));let y=28;
 const nodes=board.nodes.map(n=>{const lines=wrapArchitectureLabel(n.label),height=42+20*lines.length,p={...n,x:nodeX,y,width:nodeWidth,height,lines};y+=height+56;return p;}),positions=new Map(nodes.map(n=>[n.id,n]));
 const colors=['#a98bce','#6aa8a4','#b89667','#7d9fc4'];
 const edges=valid.map((e,i)=>{
  const a=positions.get(e.from),b=positions.get(e.to);let points;
  if(index.get(e.to)===index.get(e.from)+1)points=[[a.x+nodeWidth/2,a.y+a.height+3],[b.x+nodeWidth/2,b.y-4]];
  else{
   const backward=index.get(e.to)<index.get(e.from),peers=backward?left:right,lane=peers.indexOf(e),laneX=backward?nodeX-24-lane*laneGap:nodeX+nodeWidth+24+lane*laneGap;
   const port=(node,role)=>{const connected=peers.filter(edge=>edge[role]===node.id),slot=connected.indexOf(e);return node.y+16+(slot+1)*(node.height-32)/(connected.length+1);};
   const x=backward?a.x-3:a.x+nodeWidth+3,tx=backward?b.x-4:b.x+nodeWidth+4,sy=port(a,'from'),ty=port(b,'to');points=[[x,sy],[laneX,sy],[laneX,ty],[tx,ty]];
  }
  return {...e,points,d:points.map(([x,y],j)=>(j?'L':'M')+x+' '+y).join(' '),color:colors[i%colors.length]};
 });
 return {width,height:Math.max(150,nodes.length?y-20:150),nodes,edges};
}
