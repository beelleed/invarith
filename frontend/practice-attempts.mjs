export function comparePracticeAttempts(before,after){
  const valid=a=>a&&typeof a.suiteId==='string'&&a.suiteId&&Number.isInteger(a.total)&&a.total>0&&Array.isArray(a.statuses)&&a.statuses.length===a.total&&a.statuses.every(s=>['passed','failed','error'].includes(s))&&a.passed===a.statuses.filter(s=>s==='passed').length;
  if(!valid(before)||!valid(after)||before.suiteId!==after.suiteId||before.total!==after.total)return {comparable:false,rows:[],fixed:0,regressed:0};
  const rows=before.statuses.map((status,index)=>({index,before:status,after:after.statuses[index],change:status!=='passed'&&after.statuses[index]==='passed'?'fixed':status==='passed'&&after.statuses[index]!=='passed'?'regressed':'unchanged'}));
  return {comparable:true,rows,fixed:rows.filter(r=>r.change==='fixed').length,regressed:rows.filter(r=>r.change==='regressed').length};
}
