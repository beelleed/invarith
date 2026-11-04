export const designFields=['requirements','estimates','architecture','tradeoffs'];
export const designCriteria=['requirements','capacity','architecture','reliability','tradeoffs'];
export const designTopics=[
 ['random','Surprise me','隨機類型'],['links','URL shortener','短網址'],['chat','Chat and messaging','聊天與訊息'],['social','Social feeds','社群動態'],['video','Video and live streaming','影片與直播'],['files','File and object storage','檔案與物件儲存'],['search','Search and autocomplete','搜尋與自動完成'],['notifications','Notifications','通知系統'],['commerce','E-commerce and inventory','電商與庫存'],['payments','Payments and ledger','付款與帳務'],['booking','Booking and ticketing','預約與搶票'],['collaboration','Collaborative editing','協作編輯'],['location','Maps and location services','地圖與位置服務'],['recommendations','Recommendations','推薦系統'],['analytics','Analytics and event pipelines','分析與事件管線'],['observability','Logs, metrics and monitoring','日誌、指標與監控'],['queues','Queues and job scheduling','佇列與工作排程'],['cache','Caching and CDN','快取與 CDN'],['rate-limit','Rate limiting and API gateway','限流與 API 閘道'],['databases','Distributed databases and key-value stores','分散式資料庫與鍵值儲存'],['crawl','Web crawling','網頁爬蟲'],['identity','Authentication and authorization','身分驗證與授權'],['gaming','Real-time multiplayer systems','即時多人遊戲'],['iot','IoT and telemetry','物聯網與遙測'],['ml','ML serving and feature platforms','模型服務與特徵平台'],['delivery','Delivery and ride matching','配送與叫車配對'],['sync','Offline sync and conflict resolution','離線同步與衝突處理'],['custom','Custom topic','自訂類型'],
].map(([id,en,zh])=>({id,en,zh}));
// These neutral prompts work across scenarios and cannot leak a model-generated solution.
export const generalDesignQuestions=[
 ['requirements','What functional requirements and service goals would you clarify first?','你會先釐清哪些功能需求與服務目標？'],
 ['capacity','State your traffic and storage assumptions, with units and calculations.','請說明流量與儲存假設，列出單位與計算。'],
 ['write','Walk through the main write or state-changing flow and its data model.','請走過主要寫入或狀態變更流程，並說明資料模型。'],
 ['read','Walk through the main read or delivery flow and each component’s responsibility.','請走過主要讀取或傳送流程，說明各元件的職責。'],
 ['failure','Choose a component. What happens when it fails, and how does the system recover?','選擇一個元件，說明故障影響與復原方式。'],
 ['consistency','Which operations need consistency guarantees, and why?','哪些操作需要一致性保證？為什麼？'],
 ['growth','What happens when one customer or item becomes much more popular?','某個客戶或項目突然變得熱門時，系統會如何應對？'],
 ['tradeoffs','Compare an alternative to one design decision. When would you change your choice?','比較一項設計決策的替代方案，何時會改變選擇？'],
 ['abuse','How would you handle abuse, access control and sensitive data?','你會如何處理濫用、存取控制與敏感資料？'],
].map(([id,en,zh])=>({id,en,zh}));
export const designQuestions=[
 {id:'requirements',en:'What would you clarify before designing this URL shortener?',zh:'在設計短網址服務之前，你會先釐清哪些需求？'},
 {id:'capacity',en:'State your traffic and storage assumptions. Show the units and calculations.',zh:'請列出流量與儲存假設，說明單位與計算過程。'},
 {id:'write',en:'Walk through creating a short URL, including how you handle conflicting identifiers.',zh:'請走過建立短網址的流程，並說明識別碼衝突時怎麼處理。'},
 {id:'read',en:'Walk through a redirect request and the responsibilities of each component.',zh:'請走過一次轉址請求，說明每個元件的職責。'},
 {id:'failure',en:'Choose a component in your design. What happens if it becomes unavailable?',zh:'選擇圖中的一個元件，說明它無法使用時會發生什麼事。'},
 {id:'consistency',en:'After creating or deleting a link, what behavior should users observe across the system?',zh:'建立或刪除連結之後，使用者在系統各處應該觀察到什麼行為？'},
 {id:'growth',en:'If one link suddenly receives much more traffic, what changes in your design?',zh:'如果某一個連結突然收到大量流量，你的設計會如何應對？'},
 {id:'tradeoffs',en:'Compare an alternative to one decision you made. When would you change your choice?',zh:'針對一項設計決策比較另一種做法，什麼情況下你會改變選擇？'},
 {id:'abuse',en:'How would you address abusive link creation and unsafe destinations?',zh:'你會如何處理濫建連結與不安全的目的網址？'},
];
export const designClarifications=[
 {id:'scope',en:'Which features are required?',zh:'需要哪些功能？',answerEn:'Create a short link and redirect it. Custom aliases and analytics are optional; explain any additions.',answerZh:'核心是建立短連結與轉址。自訂別名與分析屬選做，新增功能時請解釋原因。'},
 {id:'traffic',en:'What traffic should I assume?',zh:'可以假設多少流量？',answerEn:'For this exercise: 10 million new links/day, 100 redirects per new link, peak traffic 10× the average. These are hypothetical inputs.',answerZh:'本題假設每天新增 1,000 萬條連結，每新增一條對應 100 次轉址，尖峰為平均的 10 倍；這些是練習假設。'},
 {id:'retention',en:'How long are links retained?',zh:'連結要保存多久？',answerEn:'Assume one year and 300 bytes per stored mapping before indexes, replication and operational overhead. Discuss expiry behavior.',answerZh:'假設保存一年，每筆映射 300 bytes，尚未包含索引、複本與營運額外空間；請討論到期行為。'},
 {id:'quality',en:'What are the service goals?',zh:'服務品質目標是什麼？',answerEn:'Prioritize available redirects and a hypothetical p95 latency target below 100 ms. Explain your consistency assumptions; no real benchmark is provided.',answerZh:'優先維持轉址可用性，假設 p95 延遲目標低於 100 ms。請解釋一致性假設；本題沒有提供真實效能測試。'},
];
export function emptyDesignDraft(){return {requirements:'',estimates:'',architecture:'',tradeoffs:'',board:{nodes:[],edges:[]},capacity:{dailyWrites:10000000,readRatio:100,recordBytes:300,retentionDays:365,peakFactor:10}};}
export function designCapacity(input){
 const limits={dailyWrites:[1,1000000000],readRatio:[0,10000],recordBytes:[1,1000000],retentionDays:[1,3650],peakFactor:[1,1000]};
 if(!input||Object.entries(limits).some(([key,[min,max]])=>!Number.isSafeInteger(input[key])||input[key]<min||input[key]>max))throw Error('Enter bounded whole-number capacity assumptions.');
 const storageBytes=input.dailyWrites*input.retentionDays*input.recordBytes;if(!Number.isSafeInteger(storageBytes))throw Error('Storage estimate exceeds the supported range.');
 return {writeRps:input.dailyWrites/86400,readRps:input.dailyWrites*input.readRatio/86400,peakReadRps:input.dailyWrites*input.readRatio*input.peakFactor/86400,storageBytes};
}
export function validateDesignDraft(input){
 if(!input||designFields.some(key=>typeof input[key]!=='string'||input[key].length>2500))throw Error('Keep each design section within 2,500 characters.');
 const b=input.board,kinds=['client','service','database','cache','queue'];
 if(!b||!Array.isArray(b.nodes)||b.nodes.length>10||b.nodes.some(n=>!n||!/^n\d{1,4}$/.test(n.id)||typeof n.label!=='string'||!n.label.trim()||n.label.length>48||!kinds.includes(n.kind))||new Set(b.nodes.map(n=>n.id)).size!==b.nodes.length)throw Error('Use up to 10 named architecture components.');
 const ids=new Set(b.nodes.map(n=>n.id));
 if(!Array.isArray(b.edges)||b.edges.length>20||b.edges.some(e=>!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)||new Set(b.edges.map(e=>e.from+'>'+e.to)).size!==b.edges.length)throw Error('Connect distinct existing components, up to 20 connections.');
 designCapacity(input.capacity);
 return {...Object.fromEntries(designFields.map(key=>[key,input[key]])),board:{nodes:b.nodes.map(({id,label,kind})=>({id,label,kind})),edges:b.edges.map(({from,to})=>({from,to}))},capacity:Object.fromEntries(['dailyWrites','readRatio','recordBytes','retentionDays','peakFactor'].map(key=>[key,input.capacity[key]]))};
}
