// Authored defect patches and distinguishing cases stay server-side. Public
// responses expose only version numbers, not diagnoses or reference code.
export const additionalBugs={
  bfs:[{patches:[['if grid[0][0] or grid[-1][-1]:','if grid[0][0] and grid[-1][-1]:']],cases:[[[[1,0]]]]}],
  dfs:[{patches:[['seen = {start}','seen = set()']],cases:[[[[]],0]]}],
  binary:[{patches:[['if nums[mid] < target: left = mid + 1','if nums[mid] < target: left = mid + 2']],cases:[[[1,3,5],3]]}],
  pointers:[{patches:[['if total < target: left += 1','if total < target: right -= 1']],cases:[[[1,2,4,6,9],8]]}],
  dp:[{patches:[['prev = best = 0','prev = best = nums[0] if nums else 0']],cases:[[[2]]]}],
  'dp:challenge':[{patches:[['ways = [1]+[0]*len(target)','ways = [0]*(len(target)+1)']],cases:[['','']]}],
  'bfs:challenge':[{patches:[['seen = {(0,0,k)}','seen = {(0,0)}'],['(x,y,budget) not in seen','(x,y) not in seen'],['seen.add((x,y,budget))','seen.add((x,y))']],cases:[[[[0,0,1,1],[1,0,1,0],[0,1,0,0]],1]]}],
  'monotonic:challenge':[
    {patches:[['list(heights)+[0]','list(heights)']],cases:[[[1,2,3,4]]]},
    {patches:[['start = left','start = i']],cases:[[[2,1,2]]]},
  ],
};
export const bugVersionCount=id=>1+(additionalBugs[id]?.length||0);
export function bugCode(id,reference,version){
  const bug=additionalBugs[id]?.[version-2];if(!bug)throw Error('Unsupported bug version.');
  let code=reference;for(const[from,to]of bug.patches){if(!code.includes(from))throw Error('The authored bug no longer matches its reference.');code=code.replace(from,to);}return code;
}
export const bugEdgeCases=id=>(additionalBugs[id]||[]).flatMap(bug=>bug.cases);
