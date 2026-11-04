export const designEvents=[
 {id:'unavailable',en:'unavailable for five minutes',zh:'連續五分鐘無法使用'},
 {id:'traffic',en:'receiving ten times its normal request rate',zh:'收到平常十倍的請求量'},
 {id:'slow',en:'responding ten times slower than usual',zh:'回應時間變成平常的十倍'},
];
export function designChallengeQuestion(node,eventId,language){
 const event=designEvents.find(e=>e.id===eventId);if(!event)throw Error('Unknown design scenario.');
 return language==='zh-TW'?`假設「${node.label}」${event.zh}。哪些流程會受影響？請調整白板或說明保留現有設計的理由，並解釋使用者體驗、資料一致性與復原方式的取捨。`:`Suppose “${node.label}” is ${event.en}. Which flows are affected? Update your whiteboard or justify keeping it unchanged. Explain the tradeoffs for user experience, consistency and recovery.`;
}
export function compareDesignBoards(before,after){
 const old=new Map(before.nodes.map(n=>[n.id,n])),next=new Map(after.nodes.map(n=>[n.id,n]));
 const edgeKey=e=>e.from+'>'+e.to,oldEdges=new Set(before.edges.map(edgeKey)),newEdges=new Set(after.edges.map(edgeKey));
 return {added:after.nodes.filter(n=>!old.has(n.id)).length,removed:before.nodes.filter(n=>!next.has(n.id)).length,changed:after.nodes.filter(n=>old.has(n.id)&&(old.get(n.id).label!==n.label||old.get(n.id).kind!==n.kind)).length,connectionsAdded:[...newEdges].filter(k=>!oldEdges.has(k)).length,connectionsRemoved:[...oldEdges].filter(k=>!newEdges.has(k)).length};
}
