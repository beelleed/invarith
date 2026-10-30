export const projectExamples=[
  {id:'shipping',en:'Checkout delivery boundary',zh:'結帳運費邊界',functionName:'checkout',entryFile:'main.py',intentEn:'For a nonnegative integer total, return {total, fee}. Fee is 0 at total >= 500, otherwise 60. A negative total returns {error: "invalid_total"}.',intentZh:'輸入非負整數 total，回傳 {total, fee}。total >= 500 時免運，否則運費 60。負數回傳 {error: "invalid_total"}。',
    files:{'main.py':'from pricing import delivery_fee\nfrom validation import valid_total\n\ndef checkout(total):\n    if not valid_total(total):\n        return {"error": "invalid_total"}\n    return {"total": total, "fee": delivery_fee(total)}',
      'pricing.py':'def delivery_fee(total):\n    if total > 500:\n        return 0\n    return 60',
      'validation.py':'def valid_total(total):\n    return type(total) is int and total >= 0'},
    cases:[{args:[499],expected:{total:499,fee:60}},{args:[500],expected:{total:500,fee:0}},{args:[501],expected:{total:501,fee:0}},{args:[-1],expected:{error:'invalid_total'}}]},
  {id:'cart',en:'Cart totals across modules',zh:'跨模組購物車金額',functionName:'total_due',entryFile:'main.py',intentEn:'Return {subtotal} for a list of items, summing price * quantity. Both fields are nonnegative integers. Empty cart totals 0. Invalid items return {error: "invalid_cart"}.',intentZh:'對商品串列回傳 {subtotal}，每項加總 price * quantity，兩欄皆須為非負整數。空購物車總額為 0，無效商品回傳 {error: "invalid_cart"}。',
    files:{'main.py':'from cart import subtotal\nfrom validation import valid_cart\n\ndef total_due(items):\n    if not valid_cart(items):\n        return {"error": "invalid_cart"}\n    return {"subtotal": subtotal(items)}',
      'cart.py':'def subtotal(items):\n    return sum(item["price"] for item in items)',
      'validation.py':'def valid_cart(items):\n    return isinstance(items, list) and all(\n        isinstance(item, dict) and\n        type(item.get("price")) is int and\n        type(item.get("quantity")) is int and\n        item["price"] >= 0 and item["quantity"] >= 0\n        for item in items\n    )'},
    cases:[{args:[[]],expected:{subtotal:0}},{args:[[{price:100,quantity:2},{price:50,quantity:3}]],expected:{subtotal:350}},{args:[[{price:80,quantity:0}]],expected:{subtotal:0}},{args:[[{price:-1,quantity:1}]],expected:{error:'invalid_cart'}}]},
  {id:'permissions',en:'Document access across modules',zh:'跨模組文件權限',functionName:'can_open',entryFile:'main.py',intentEn:'For valid roles viewer, editor or admin, return true when the user is an admin OR owns the document. Unknown roles return false, even for owners. User and owner IDs are integers.',intentZh:'有效角色為 viewer、editor、admin。管理員或文件擁有者可開啟文件，回傳 true；未知角色即使是擁有者也回傳 false。user_id 與 owner_id 為整數。',
    files:{'main.py':'from permissions import allowed\nfrom roles import valid_role\n\ndef can_open(role, user_id, owner_id):\n    if not valid_role(role):\n        return False\n    return allowed(role, user_id, owner_id)',
      'permissions.py':'def allowed(role, user_id, owner_id):\n    return role == "admin" and user_id == owner_id',
      'roles.py':'def valid_role(role):\n    return role in ("viewer", "editor", "admin")'},
    cases:[{args:['admin',1,2],expected:true},{args:['viewer',2,2],expected:true},{args:['viewer',1,2],expected:false},{args:['unknown',2,2],expected:false}]},
];

const normalized=value=>Array.isArray(value)?value.map(normalized):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalized(value[key])])):value;
const key=c=>JSON.stringify(normalized({args:c.args,kwargs:c.kwargs||{},expected:c.expected}));
export function compareProjects(before,after){
  if(!before||!after)return null;
  if(before.entryFile!==after.entryFile||before.functionName!==after.functionName||before.intent!==after.intent||before.cases.length!==after.cases.length)return {comparable:false};
  const prior=new Map();before.cases.forEach((c,i)=>{const id=key(c);if(!prior.has(id))prior.set(id,[]);prior.get(id).push(before.evidence.results[i]?.status);});
  let fixed=0,regressed=0;
  for(let i=0;i<after.cases.length;i++){const queue=prior.get(key(after.cases[i])),latest=after.evidence.results[i]?.status;if(!queue?.length||!['passed','failed','error'].includes(latest))return {comparable:false};const old=queue.shift();if(!['passed','failed','error'].includes(old))return {comparable:false};if(old!=='passed'&&latest==='passed')fixed++;if(old==='passed'&&latest!=='passed')regressed++;}
  return {comparable:true,total:after.cases.length,fixed,regressed};
}
