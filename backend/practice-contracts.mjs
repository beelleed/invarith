import {bugCode,bugVersionCount,bugEdgeCases} from './practice-bugs.mjs';
import {createHash} from 'node:crypto';
import {practiceChallenges} from './practice-challenges.mjs';
import {createPracticeVariants} from './practice-variants.mjs';
import {expandedFamilies} from './practice-expanded.mjs';
import {practiceTopics} from '../frontend/practice-topics.mjs';
import {practiceDifficulty,practiceLevels,practiceTaskId} from '../frontend/practice-difficulty.mjs';
export const practiceFamilies={
  bfs:{name:'shortest_route',params:'grid',en:'Given a nonempty rectangular grid of 0 (open) and 1 (blocked), return the fewest four-directional moves from the top-left to the bottom-right. Return -1 if either endpoint is blocked or no route exists. A single open cell requires 0 moves. Grid dimensions are at most 12 by 12.',zh:'給定非空矩形 grid，0 是可通行、1 是障礙，只能上下左右移動。回傳從左上角到右下角的最少移動次數；起點或終點受阻、或沒有路徑時回傳 -1。單一可通行格需要 0 次移動。大小最多 12 × 12。',samples:[[[[0]]],[[[0,1],[0,0]]],[[[0,1],[1,0]]]],
    oracle:([grid])=>{const m=grid.length,n=grid[0].length;if(grid[0][0]||grid[m-1][n-1])return -1;const q=[[0,0,0]],seen=new Set(['0,0']);for(let head=0;head<q.length;head++){const [r,c,d]=q[head];if(r===m-1&&c===n-1)return d;for(const [dr,dc]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=r+dr,y=c+dc,k=`${x},${y}`;if(x>=0&&x<m&&y>=0&&y<n&&!grid[x][y]&&!seen.has(k)){seen.add(k);q.push([x,y,d+1]);}}}return -1;},
    reference:'def shortest_route(grid):\n    from collections import deque\n    m, n = len(grid), len(grid[0])\n    if grid[0][0] or grid[-1][-1]: return -1\n    q = deque([(0, 0, 0)])\n    seen = {(0, 0)}\n    while q:\n        r, c, d = q.popleft()\n        if (r, c) == (m-1, n-1): return d\n        for x, y in ((r+1,c),(r-1,c),(r,c+1),(r,c-1)):\n            if 0 <= x < m and 0 <= y < n and not grid[x][y] and (x,y) not in seen:\n                seen.add((x,y))\n                q.append((x,y,d+1))\n    return -1',
    slow:'def shortest_route(grid):\n    m, n = len(grid), len(grid[0])\n    if grid[0][0] or grid[-1][-1]: return -1\n    dist = {(r,c): 10**9 for r in range(m) for c in range(n) if grid[r][c] == 0}\n    dist[(0,0)] = 0\n    pending = list(dist)\n    while pending:\n        best = 0\n        for i in range(len(pending)):\n            if dist[pending[i]] < dist[pending[best]]: best = i\n        r, c = pending.pop(best)\n        if dist[(r,c)] == 10**9: return -1\n        if (r,c) == (m-1,n-1): return dist[(r,c)]\n        for x,y in ((r+1,c),(r-1,c),(r,c+1),(r,c-1)):\n            if (x,y) in dist: dist[(x,y)] = min(dist[(x,y)],dist[(r,c)]+1)\n    return -1',
  },
  dfs:{name:'reachable_count',params:'graph, start',en:'Given an adjacency list graph of 1 to 30 vertices labeled 0..n-1 and valid start, return how many distinct vertices can be reached, including start. Edges are directed. Self-loops and cycles may exist; never count a vertex twice.',zh:'給定 1 到 30 個頂點的鄰接串列 graph，頂點編號為 0..n-1，以及有效起點 start，回傳可到達的不同頂點數（包含起點）。邊有方向，可能有自環與環路，每個頂點只計一次。',samples:[[[[]],0],[[[1],[2],[]],0],[[[1],[0],[]],0]],
    oracle:([g,start])=>{const seen=new Set([start]),stack=[start];while(stack.length)for(const next of g[stack.pop()])if(!seen.has(next)){seen.add(next);stack.push(next);}return seen.size;},
    reference:'def reachable_count(graph, start):\n    seen = {start}\n    stack = [start]\n    while stack:\n        node = stack.pop()\n        for nxt in graph[node]:\n            if nxt not in seen:\n                seen.add(nxt)\n                stack.append(nxt)\n    return len(seen)',
    slow:'def reachable_count(graph, start):\n    n = len(graph)\n    reach = [[False]*n for _ in range(n)]\n    for i in range(n):\n        reach[i][i] = True\n        for j in graph[i]: reach[i][j] = True\n    for k in range(n):\n        for i in range(n):\n            for j in range(n):\n                reach[i][j] = reach[i][j] or (reach[i][k] and reach[k][j])\n    return sum(reach[start])',
  },
  binary:{name:'first_position',params:'nums, target',en:'Given an ascending sorted integer list nums (possibly containing duplicates) and integer target, return its first zero-based index, or -1 if absent. Empty input returns -1. The list has at most 400 values in [-1000,1000].',zh:'給定由小到大排序、可含重複值的整數串列 nums 與整數 target，回傳 target 第一次出現的零起算索引，找不到回傳 -1。空串列回傳 -1。最多 400 個元素，數值介於 -1000 到 1000。',samples:[[[1,3,3,8],3],[[],3],[[2],2]],
    oracle:([a,t])=>a.indexOf(t),
    reference:'def first_position(nums, target):\n    left, right = 0, len(nums)\n    while left < right:\n        mid = (left + right) // 2\n        if nums[mid] < target: left = mid + 1\n        else: right = mid\n    return left if left < len(nums) and nums[left] == target else -1',
    slow:'def first_position(nums, target):\n    for i in range(len(nums)):\n        if nums[i] == target: return i\n    return -1',
  },
  pointers:{name:'pair_positions',params:'nums, target',en:'Given an ascending sorted list of distinct integers nums and integer target, return the lexicographically smallest pair [i,j], i<j, with nums[i]+nums[j]==target. Return [] if none exists. The list has at most 400 values in [-1000,1000].',zh:'給定由小到大排序且元素不重複的整數串列 nums 與整數 target，回傳滿足 nums[i]+nums[j]==target、i<j 的字典序最小索引對 [i,j]（優先最小 i）。沒有解回傳 []。最多 400 個元素，數值介於 -1000 到 1000。',samples:[[[1,2,4,6,9],8],[[],8],[[1,2,3,4],5]],
    oracle:([a,t])=>{for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]+a[j]===t)return [i,j];return [];},
    reference:'def pair_positions(nums, target):\n    left, right = 0, len(nums)-1\n    while left < right:\n        total = nums[left]+nums[right]\n        if total == target: return [left,right]\n        if total < target: left += 1\n        else: right -= 1\n    return []',
    slow:'def pair_positions(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1,len(nums)):\n            if nums[i]+nums[j] == target: return [i,j]\n    return []',
  },
  ...expandedFamilies,
};
export const practiceVariants=createPracticeVariants(practiceFamilies);
export const practiceTasks={...practiceChallenges,...practiceFamilies,...Object.fromEntries(Object.entries(practiceVariants).map(([family,task])=>[family+':extended',task]))};
export function selectPracticeTask(family,level='mixed',recent=[],difficulty='any'){
  if(!practiceFamilies[family]||!['mixed','standard','extended','challenge'].includes(level)||!['any','easy','medium','hard'].includes(difficulty))return null;
  const candidates=(level==='mixed'?practiceLevels(family):[level]).map(item=>practiceTaskId(family,item)).filter(id=>practiceTasks[id]&&(difficulty==='any'||practiceDifficulty(id)===difficulty));
  if(!recent.length)return candidates[0]||null;
  const index=candidates.indexOf(recent[0]);return candidates[(index+1)%candidates.length]||null;
}
export function resolvePracticeTopic(value){
  if(typeof value!=='string'||value.length>500)return null;
  const exact=practiceTopics.find(t=>t.id===value||t.en.toLowerCase()===value.toLowerCase()||t.zh===value);
  if(exact)return exact.id;
  // Prefer specific concepts (prefix tree, monotonic stack) over generic ones.
  const lower=value.toLowerCase();
  const matches=practiceTopics.flatMap(t=>t.aliases.filter(a=>{
    const index=lower.indexOf(a);if(index<0)return false;
    if(/^[a-z ]+$/.test(a))return !/[a-z]/.test(lower[index-1]||'') && (!/[a-z]/.test(lower[index+a.length]||'')||lower.slice(index+a.length).match(/^s(?:[^a-z]|$)/));
    return true;
  }).map(a=>({id:t.id,length:a.length})));
  return matches.sort((a,b)=>b.length-a.length)[0]?.id||null;
}
export function practiceSuite(family,seed){
  const taskId=family,task=practiceTasks[family];if(!task)throw Error('Unknown family');family=task.family||family;let state=createHash('sha256').update(String(seed)).digest().readUInt32LE(0)||1;
  const random=n=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)%n;};
  const cases=args=>({args,expected:task.oracle(args)}),examples=task.samples.map(args=>cases(structuredClone(args))),hidden=[];
  const mandatory=task.mandatory?[...task.samples,...task.mandatory]:task.random?[...task.samples,...(family==='stack'?[["("]]:[])]:family==='bfs'?[[[[1]]],[[[0,0,0]]],[[[0],[0],[0]]],[[[0,0],[1,0]]],[[[0,1],[0,1]]]]:family==='dfs'?[[[[0]],0],[[[1],[],[0]],2],[[[],[],[]],1]]:family==='binary'?[[[1,1,1],1],[[1,3,5],5],[[1],0],[[0,0,2],2]]:[[[4],8],[[1,2,3,4],5],[[2,6],8],[[0,2,5],5]];
  [...mandatory,...bugEdgeCases(taskId)].forEach(args=>hidden.push(cases(structuredClone(args))));
  while(hidden.length<20){let args;if(task.random){args=task.random(random);}else if(family==='bfs'){const m=1+random(5),n=1+random(5);args=[Array.from({length:m},()=>Array.from({length:n},()=>random(4)===0?1:0))];}else if(family==='dfs'){const n=1+random(10);args=[Array.from({length:n},()=>Array.from({length:n},(_,i)=>i).filter(()=>random(4)===0)),random(n)];}else{let a=Array.from({length:random(15)},()=>random(41)-20).sort((a,b)=>a-b);if(family==='pointers')a=[...new Set(a)];args=[a,random(41)-20];}hidden.push(cases(args));}
  examples.splice(1,2,...hidden.splice(18,2));
  const stress=[1,2,3].map(scale=>{let args;if(task.random){args=structuredClone(task.samples[scale-1]);}else if(family==='bfs'){const n=scale*4;args=[Array.from({length:n},()=>Array(n).fill(0))];}else if(family==='dfs'){const n=scale*10;args=[Array.from({length:n},(_,i)=>i+1<n?[i+1]:[]),0];}else args=[Array.from({length:scale*80},(_,i)=>i),-1];return cases(args);});
  hidden.splice(15,3,...structuredClone(stress));
  return {examples,hidden,stress};
}
export function practiceStarter(family,mode,version=1){const task=practiceTasks[family];if(mode==='coding')return `def ${task.name}(${task.params}):\n    raise NotImplementedError\n`;if(mode==='optimize'){if(!task.slow)throw Error('Optimization practice is not available for this topic.');return task.slow;}
  if(!Number.isInteger(version)||version<1||version>bugVersionCount(family))throw Error('Unsupported bug version.');
  if(version>1)return bugCode(family,task.reference,version);
  if(task.mutation)return task.reference.replace(task.mutation.from,task.mutation.to);
  return family==='bfs'?task.reference.replace('return d\n','return d+1\n'):family==='dfs'?task.reference.replace('return len(seen)','return len(seen)-1'):family==='binary'?task.reference.replace('nums[mid] < target','nums[mid] <= target'):task.reference.replace('while left < right:','while left + 1 < right:');
}
