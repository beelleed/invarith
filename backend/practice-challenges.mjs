// Hard contracts add a new reasoning requirement, not merely bigger inputs.
export const practiceChallenges={
  'bfs:challenge':{
    family:'bfs',name:'shortest_with_breaks',params:'grid, k',
    en:'Return the fewest four-directional moves from top-left to bottom-right in a nonempty rectangular 0/1 grid, where entering a blocked cell (1) consumes one of k eliminations. Re-entering a blocked cell consumes again. Return -1 if impossible. Both endpoints are 0; a single cell needs 0 moves. Dimensions 1..8, k=0..3. Visiting the same cell with a different remaining budget is a distinct search state.',
    zh:'在非空 0/1 矩形 grid 中，回傳從左上到右下的最少上下左右移動次數。每次進入障礙格（1）消耗一次消除額度，最多 k 次；再次進入同一障礙仍會消耗。無法到達回傳 -1。兩端點皆為 0，單格需 0 次移動。列、行各 1..8，k=0..3。同一位置但剩餘額度不同，是不同搜尋狀態。',
    samples:[[[[0]],0],[[[0,1,0]],1],[[[0,1],[1,0]],0]],
    mandatory:[[[[0,1,0]],0],[[[0,1,0]],1],[[[0,0,0],[1,1,0],[0,0,0],[0,1,1],[0,0,0]],1]],
    oracle:([grid,k])=>{
      // Repeated relaxation over the expanded graph, independent of Python BFS.
      const m=grid.length,n=grid[0].length,dist=Array.from({length:m},()=>Array.from({length:n},()=>Array(k+1).fill(Infinity)));
      dist[0][0][0]=0;
      for(let pass=0;pass<m*n*(k+1);pass++){
        let changed=false;
        for(let r=0;r<m;r++)for(let c=0;c<n;c++)for(let used=0;used<=k;used++){
          if(!Number.isFinite(dist[r][c][used]))continue;
          for(const[x,y]of[[r+1,c],[r-1,c],[r,c+1],[r,c-1]])if(x>=0&&x<m&&y>=0&&y<n){const next=used+grid[x][y];if(next<=k&&dist[x][y][next]>dist[r][c][used]+1){dist[x][y][next]=dist[r][c][used]+1;changed=true;}}
        }
        if(!changed)break;
      }
      const answer=Math.min(...dist[m-1][n-1]);return Number.isFinite(answer)?answer:-1;
    },
    reference:'def shortest_with_breaks(grid, k):\n    from collections import deque\n    m, n = len(grid), len(grid[0])\n    queue = deque([(0,0,k,0)])\n    seen = {(0,0,k)}\n    while queue:\n        r, c, remaining, distance = queue.popleft()\n        if (r,c) == (m-1,n-1): return distance\n        for x, y in ((r+1,c),(r-1,c),(r,c+1),(r,c-1)):\n            if 0 <= x < m and 0 <= y < n:\n                budget = remaining-grid[x][y]\n                if budget >= 0 and (x,y,budget) not in seen:\n                    seen.add((x,y,budget))\n                    queue.append((x,y,budget,distance+1))\n    return -1',
    mutation:{from:'budget >= 0',to:'budget > 0'},
    random:r=>{const m=1+r(6),n=1+r(6),grid=Array.from({length:m},()=>Array.from({length:n},()=>r(3)===0?1:0));grid[0][0]=grid[m-1][n-1]=0;return[grid,r(4)];},
  },
  'dp:challenge':{
    family:'dp',name:'count_formations',params:'source, target',
    en:'Count distinct choices of increasing indices in source whose characters spell target. Characters need not be adjacent. Repeated characters at different indices count as distinct choices. Empty target has exactly one choice; empty source cannot form a nonempty target. Lowercase ASCII only, source length 0..24, target length 0..12. Return an integer.',
    zh:'計算從 source 選出嚴格遞增索引、依序拼成 target 的不同方式數。字元不需相鄰，數值相同但索引不同的選法分別計算。空 target 恰有一種選法；空 source 無法組成非空 target。只含小寫英文，source 長度 0..24，target 長度 0..12。回傳整數。',
    samples:[['rabbbit','rabbit'],['',''],['a','aa']],
    mandatory:[['aaaa','aa'],['babgbag','bag'],['abc',''],['','a']],
    oracle:([source,target])=>{
      const memo=new Map();function count(i,j){if(j===target.length)return 1;if(source.length-i<target.length-j)return 0;const key=`${i},${j}`;if(memo.has(key))return memo.get(key);let ways=0;for(let p=i;p<source.length;p++)if(source[p]===target[j])ways+=count(p+1,j+1);memo.set(key,ways);return ways;}return count(0,0);
    },
    reference:'def count_formations(source, target):\n    ways = [1]+[0]*len(target)\n    for char in source:\n        for j in range(len(target), 0, -1):\n            if char == target[j-1]: ways[j] += ways[j-1]\n    return ways[-1]',
    mutation:{from:'range(len(target), 0, -1)',to:'range(1, len(target)+1)'},
    random:r=>{const word=n=>Array.from({length:r(n+1)},()=>'abc'[r(3)]).join('');return[word(20),word(10)];},
  },
  'monotonic:challenge':{
    family:'monotonic',name:'largest_rectangle',params:'heights',
    en:'Return the maximum rectangle area under a histogram of adjacent bars with width 1 and nonnegative integer heights. A rectangle must span contiguous bars and cannot exceed any covered bar. Empty input returns 0. At most 80 bars, heights in [0,100].',
    zh:'回傳直方圖下方可容納的最大矩形面積。每根柱寬度為 1，高度為非負整數。矩形必須跨越連續柱，且不能超過任何被覆蓋柱的高度。空輸入回傳 0。最多 80 根柱，高度在 [0,100]。',
    samples:[[[2,1,5,6,2,3]],[[2,2]],[[]]],
    mandatory:[[[1]],[[1,2,3,4]],[[4,3,2,1]],[[0,3,0]],[[3,3,3]]],
    oracle:([a])=>{let best=0;for(let i=0;i<a.length;i++){let height=Infinity;for(let j=i;j<a.length;j++){height=Math.min(height,a[j]);best=Math.max(best,height*(j-i+1));}}return best;},
    reference:'def largest_rectangle(heights):\n    stack = []\n    best = 0\n    for i, height in enumerate(list(heights)+[0]):\n        start = i\n        while stack and stack[-1][1] > height:\n            left, previous = stack.pop()\n            best = max(best, previous*(i-left))\n            start = left\n        stack.append((start, height))\n    return best',
    mutation:{from:'previous*(i-left)',to:'previous*(i-left+1)'},
    random:r=>[Array.from({length:r(45)},()=>r(21))],
  },
};
