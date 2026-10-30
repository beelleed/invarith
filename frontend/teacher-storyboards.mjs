// Original teaching scripts. Diagram examples are authored illustrations;
// only the attached before/after records are execution evidence.
export const teacherLessonVersion='teacher-v1';
const cue=(note,zh,en,scene)=>({note,zh,en,scene});
const chapter=(id,title,caption,cues,extra={})=>({id,kind:'teaching',title,caption,line:1,variables:{},changes:[],teaching:{cues},narration:cues.map(item=>item.en).join(' '),narrationZh:cues.map(item=>item.zh).join(' '),...extra});

function binary(example){
  const array=(extra={})=>({type:'array',values:[1,3,5],left:0,right:2,target:5,...extra});
  return [
    chapter('problem','Find the target without checking every number','Start with the problem, then use the sorted order.',[
      cue('A scan checks candidates one by one.','先把程式放旁邊。假設你要在這排數字裡找到五，最直覺的方法，就是從左邊一個一個看。這個方法沒錯，只是資料很多時，你可能得看完整排。','Put the code aside for a moment. To find five, we could check each value from left to right. That works, but a long list might make us inspect every value.',array({focus:0,annotation:'Scan: 1 → 3 → 5'})),
      cue('Sorted order lets us rule out a whole region.','但這裡多了一個很有用的條件：數字已經排好順序。所以我們不只是在問，這個數字對不對；我們還可以問，哪一整段已經不可能有答案。','The useful extra condition is that the values are sorted. Instead of only asking whether one value matches, we can ask which entire region cannot contain the answer.',array({focus:1,annotation:'Sorted order is information.'})),
      cue('Keep the possible locations; remove only impossible ones.','二分搜尋的重點就在這裡。每一步都保留還有可能的範圍，只刪掉可以確定不可能的部分。接下來我們就用這三個數字，把這個想法走一遍。','That is the idea behind binary search: keep the possible locations and remove only those we can rule out. Let us work through this small example.',array({annotation:'Keep all remaining candidates.'})),
    ]),
    chapter('invariant','What do left and right actually mean?','Both endpoints belong to the candidate range.',[
      cue('left and right are included, not excluded.','現在看左邊的箭頭和右邊的箭頭。它們不是兩道不能碰的牆，而是目前候選範圍的第一個位置和最後一個位置。兩個端點本身，都還有可能是答案。','Look at the left and right arrows. They are not walls that we cannot touch. They mark the first and last possible positions, and both endpoints are included.',array({annotation:'Candidates include both endpoints.'})),
      cue('Our promise: if the target exists, it is still in this range.','所以我們要一直守住一個約定：只要目標存在，它就還留在這個範圍裡。這就是為什麼更新箭頭時，不能只是看哪個寫法順眼，而要能解釋被刪掉的位置為什麼不可能。','Our promise is that if the target exists, it remains inside this range. An update needs a reason: every position we remove must be impossible.',array({focus:2,annotation:'Invariant: never discard a possible answer.'})),
    ]),
    chapter('midpoint','Why take the midpoint?','A midpoint is an index, so a fraction must become a valid integer.',[
      cue('Average the two indices, not the array values.','我們先挑中間的位置。注意，這裡平均的是左右兩個索引，不是把陣列裡的數字拿來平均。左索引是零，右索引是二，所以中點就是一，對應到數字三。','We choose a middle position by averaging the two indices, not the values in the array. Left is zero and right is two, so the middle index is one. Its value is three.',array({mid:1,focus:1,equation:'mid = floor((0 + 2) / 2) = 1'})),
      cue('Floor means the greatest integer no larger than the fraction.','如果算出來不是整數，例如左右索引是零和三，平均會是一點五。索引不能用一點五，所以這裡向下取整，得到一。公式外面像兩個直角的符號，就是向下取整，不是四捨五入。','If the endpoints were zero and three, their average would be one point five. An index must be an integer. Floor chooses one, the greatest integer no larger than one point five. It does not round to the nearest integer.',array({mid:1,focus:1,equation:'floor(1.5) = 1',annotation:'⌊z⌋ means floor; Python uses // here.'})),
    ],{formula:example.formula}),
    chapter('eliminate','Why can the left half go away?','The comparison justifies the discarded region.',[
      cue('Compare the middle value 3 with target 5.','中間的值是三，我們要找的是五。因為五比三大，而且整排已經排序，三左邊的值只會更小。所以不只是三不符合，連三左邊那一整段，都可以排除了。','The middle value is three and our target is five. Five is larger. Because the list is sorted, everything to the left is even smaller. We can rule out that whole region, including the middle position.',array({mid:1,focus:1,annotation:'3 < 5 → positions 0 and 1 are impossible.'})),
      cue('Move left past the tested midpoint.','因此左箭頭移到中點的下一個位置，也就是二。為什麼不是停在中點？因為三已經檢查過了，再留下它只是在重複做一樣的事。','Move left to the position after the midpoint, which is index two. Why not leave it at the midpoint? We already checked three; keeping it would repeat work.',array({left:2,right:2,mid:null,focus:2,annotation:'left = mid + 1 = 2'})),
    ]),
    chapter('predict','One candidate remains. Are we finished?','Pause here and predict before revealing the explanation.',[
      cue('Both pointers now refer to the same valid position.','先停一下。現在左右箭頭都指向索引二，而那個位置的值就是五。你覺得左右相等，代表沒有候選位置了，還是代表只剩下一個？先選一個答案，再看下一段。','Pause here. Both pointers now refer to index two, whose value is five. Does equality mean no candidates remain, or exactly one remains? Choose an answer before we continue.',array({left:2,right:2,focus:2,annotation:'left = right = 2'})),
    ],{checkpoint:{question:'When left = right = 2, how many candidate positions remain?',choices:['None','Exactly one','Two'],correct:1,explanation:'The range includes both endpoints. When they coincide, the shared endpoint is still one candidate.'}}),
    chapter('diagnosis','Equality is the last candidate, not an empty range','The bug is the stopping rule, not the midpoint formula.',[
      cue('An inclusive range still contains its shared endpoint.','答案是還剩下一個。你可以想成，第一頁和最後一頁都是同一頁的書，並不是一本空白的書。同樣地，左右相等時，這個位置還必須被檢查。','Exactly one remains. A book whose first and last page are the same page still contains a page. Likewise, equal endpoints still describe one position that needs checking.',array({left:2,right:2,focus:2,annotation:'Inclusive range size: right − left + 1 = 1'})),
      cue('The strict comparison rejects that last valid state.','現在才回頭看原本的迴圈。它要求左邊嚴格小於右邊，所以兩邊相等就停止了。這樣會漏掉最後那個候選者。範例的實際執行也的確回傳找不到，而不是索引二。','Now look at the original loop. It continues only while left is strictly less than right. It stops at equality and misses the last candidate. The saved run returned not found instead of index two.',{type:'code',line:3,annotation:'left < right rejects the one-candidate state.'}),
    ]),
    chapter('repair','Translate the range meaning into the loop condition','An inclusive range is empty only after left passes right.',[
      cue('Continue while at least one candidate is left.','修正的方式，是把我們剛才講清楚的意思，翻成條件：只要還有候選者，就繼續。對包含兩個端點的範圍來說，左邊小於等於右邊，都還有候選者。','Translate our reasoning into a condition: continue while at least one candidate remains. For an inclusive range, that means left is less than or equal to right.',{type:'code',line:3,annotation:'while left <= right:',repaired:true}),
      cue('Empty input is a different state: left = 0, right = −1.','那空清單呢？一開始左索引是零，右索引是負一。這次左邊真的超過右邊，所以不進迴圈，直接回傳找不到。你看，兩個情況現在都有同一套解釋，不需要再硬加例外。','For an empty list, left starts at zero and right at negative one. Left has passed right, so the range really is empty. We skip the loop and return not found. The same rule explains both cases.',array({values:[],left:0,right:-1,annotation:'Empty range: left > right'})),
    ],{kind:'repair'}),
    chapter('evidence','Prove the repair on the same tests','Read real execution evidence, then explain the idea in an interview.',[
      cue('The execution runner, not the narration, determines pass or fail.','最後把原本的測試重新跑一次。右側顯示的是實際執行留下的結果，不是老師口頭說它正確。修正後，這三個既有案例都通過了，但這還不代表所有可能輸入都已經測過。','Finally, rerun the original tests. These are saved execution results, not a claim made by the narrator. The corrected implementation passed the three supplied cases, which still does not prove every possible input.',{type:'evidence'}),
      cue('Interview explanation: sorted order → invariant → shrink → stop.','如果面試官要你解釋，就照這個順序說：排序讓我們能排除一半；左右端點包住仍可能的答案；每一步都縮小範圍；等到左邊超過右邊，才表示沒有候選者。比起背一行小於等於，這樣你才知道什麼時候該用它。','In an interview, explain the sorted-order argument, the candidate-range invariant, how each step shrinks the range, and why the loop stops only after left passes right. That is more useful than memorizing one comparison.',{type:'evidence',annotation:'For n > 0: O(log n) time, O(1) auxiliary space.'}),
    ],{kind:'outcome'}),
  ];
}

function mean(example){
  const share=(extra={})=>({type:'sharing',values:[2,4,6],...extra});
  return [
    chapter('problem','What does an average tell us?','Understand equal sharing before reading a formula.',[
      cue('Imagine redistributing the same total equally.','先別急著背公式。想像三個人分別有兩顆、四顆和六顆糖果。平均值想回答的是：如果糖果總數不變，重新平均分給三個人，每個人會拿到幾顆？','Before memorizing a formula, imagine three people with two, four, and six sweets. The average asks how many each would have if we redistributed the same total equally.',share()),
      cue('Moving sweets changes who has them, not how many exist.','我們把多的挪給少的，最後三個人都拿到四顆。這個過程最重要的是，糖果沒有變多也沒有變少，只是分配變平均了。所以平均值是四，不是隨便挑中間那個數字。','Move sweets from the person with more to the one with less. Each ends with four. The total stays unchanged; only the distribution changes. Four is the equal share, not an arbitrary choice of the middle value.',share({balanced:true,equation:'2 + 4 + 6 = 4 + 4 + 4'})),
    ]),
    chapter('formula','Turn equal sharing into a calculation','Sum gives the total; count gives the number of shares.',[
      cue('First calculate how much we have to distribute.','現在公式就有意義了。先把所有數字加起來，二加四加六，一共十二。公式裡像大寫英文字母的希臘符號 Sigma，就是把這些值全部加起來的簡寫。','Now the formula has a meaning. Add two, four, and six to get twelve. The Greek symbol Sigma is shorthand for adding all the values.',share({equation:'Σ xᵢ = 2 + 4 + 6 = 12',focus:'sum'})),
      cue('Then divide by the number of recipients.','接著要分給三個人，所以十二除以三，得到四。字母 n 代表數量；x 下標 i 代表第 i 個值。你不需要怕這些符號，它們只是把「總共有多少」和「要分成幾份」寫得簡潔一點。','Then divide twelve by three recipients to get four. The letter n is the count, and x subscript i is the value at position i. The symbols just shorten the questions: how much do we have, and how many shares are there?',share({balanced:true,equation:'mean = (Σ xᵢ) / n = 12 / 3 = 4'})),
    ],{formula:example.formula}),
    chapter('predict','What changes when the list is empty?','A successful normal case can hide an invalid operation.',[
      cue('There is no recipient when n is zero.','現在把三個人全部拿掉，也就是輸入空清單。總和是零，人數也是零。你覺得剛才「總和除以數量」的操作，現在還做得下去嗎？先預測程式會回傳零，還是先發生錯誤。','Now remove all three recipients: the input is an empty list. The total and count are both zero. Can the same division still work? Predict whether the code returns zero or raises an error first.',share({values:[],equation:'sum = 0; count = 0'})),
    ],{checkpoint:{question:'What does the original function do for []?',choices:['Returns 0','Raises a division-by-zero error','Returns an empty list'],correct:1,explanation:'It evaluates 0 / 0 before any application-specific empty-input result can be returned.'}}),
    chapter('policy','A mathematical formula is not the whole contract','Separate the formula domain from the product decision.',[
      cue('Zero divided by zero does not define an arithmetic mean.','這裡會先出錯。零除以零在數學上沒有定義，Python 也不會自動幫你決定一個平均值。所以這不是總和算錯，而是我們把公式用在它不適用的情況。','The original code raises an error. Zero divided by zero is undefined; Python will not invent an average. The sum is not wrong. We applied the formula outside its domain.',share({values:[],equation:'n = 0 → 0 / 0 is undefined'})),
      cue('Returning zero for an empty list is an explicit application rule.','那為什麼這個範例希望得到零？因為產品需求另外規定，空清單要回傳零。別把這兩件事混在一起：一般的平均值公式要求數量大於零；空清單回傳零，是這個應用自己訂的規則。','Why does this example expect zero? Because its application contract explicitly chooses zero for an empty list. Keep those ideas separate: the arithmetic mean requires a positive count; the empty-list result is a product policy.',share({values:[],equation:'n > 0: mean formula     n = 0: explicit policy'})),
    ]),
    chapter('repair','Handle the invalid domain before dividing','The guard protects the operation that follows.',[
      cue('Put the empty-input decision before the risky operation.','所以修正時，先問清單有沒有東西。沒有，就按照產品規則回傳零；有，才繼續做加總和除法。這個順序很重要，把檢查放在除法後面，就像摔倒以後才鋪防滑墊，已經來不及了。','Check whether the list is empty before dividing. If it is empty, return the contract result. Otherwise, sum and divide. Checking after division would be too late: the unsafe operation has already happened.',{type:'code',line:2,repaired:true,annotation:'Guard first; divide only when count > 0.'}),
      cue('Negative values still use the same arithmetic rule.','再想一個不同的例子，負四和二。總和是負二，數量是二，所以平均是負一。負數不需要另一套公式；真正需要另外處理的，是數量為零。','For a different example, use negative four and two. Their sum is negative two and the count is two, so the mean is negative one. Negative values use the same formula; zero count is the distinct case.',share({values:[-4,2],equation:'(−4 + 2) / 2 = −1'})),
    ],{kind:'repair'}),
    chapter('evidence','Verify the contract, not just the happy path','Normal values, empty input and negative values have separate checks.',[
      cue('Use execution evidence to check all three expectations.','現在重新執行原本三個測試：一般的二、四、六，空清單，還有包含負數的清單。畫面上的結果來自 Python 實際執行。修正後三個案例都符合原本的預期，沒有為了讓測試變綠而改答案。','Rerun the unchanged tests for normal values, empty input, and negative values. The displayed results come from Python execution. All three now match their original expectations; we did not change the expected values to make them pass.',{type:'evidence'}),
      cue('Transfer the method: check the domain of the next operation.','下次遇到比例、速度，或成功率的計算，也可以先問自己：分母代表什麼，它可能是零嗎？你今天學到的不只是一個空清單判斷，而是在計算之前，先檢查這個操作成立的條件。','For ratios, speeds, or success rates, ask what the denominator means and whether it can be zero. The reusable skill is checking the conditions that make an operation valid before performing it.',{type:'evidence',annotation:'Sum and count: O(n) time, O(1) auxiliary space.'}),
    ],{kind:'outcome'}),
  ];
}

function delivery(example){
  const rule=(extra={})=>({type:'threshold',threshold:500,...extra});
  return [
    chapter('problem','Does exactly $500 get free delivery?','Turn a sentence into a boundary decision.',[
      cue('“At least” includes the threshold itself.','假設店家寫，消費滿五百就免運。四百九十九要付運費，五百零一不用，這兩個通常都沒爭議。真正容易被漏掉的，是剛好五百：它應該站在哪一邊？','A shop promises free delivery for orders of at least five hundred. Four ninety-nine pays a fee; five hundred and one does not. The easy-to-miss question is where exactly five hundred belongs.',rule({focus:500,annotation:'At least $500: is equality included?'})),
      cue('The words determine the rule; the code must follow it.','「滿五百」的意思，是五百本身就達到門檻。所以我們先把這個意思講清楚，再去選程式裡的比較符號。順序不要倒過來，不是先寫了大於，再想辦法替它找理由。','At least five hundred includes five hundred itself. Establish that meaning before choosing the comparison operator. Do not choose an operator first and invent a justification afterward.',rule({inclusive:true,focus:500,annotation:'Exactly $500 belongs in the free-delivery region.'})),
    ]),
    chapter('formula','A piecewise rule chooses one of two outcomes','The condition decides the branch; it is not a fee calculation.',[
      cue('Below the threshold, use 60; at or above it, use 0.','這裡的規則其實是兩個分支。金額還沒到五百，就回傳六十；到了五百或更多，就回傳零。公式分成兩段，不是要你做很難的數學，只是在把這兩個情況寫清楚。','This is a two-branch rule. Below five hundred, return sixty. At or above five hundred, return zero. A piecewise formula is simply a precise way to state those two cases.',rule({inclusive:true,equation:'fee(x) = 60 below 500; otherwise 0'})),
      cue('A filled boundary includes equality; an open one excludes it.','看圖上五百的位置。包含相等，就把這個點放進免運的範圍；如果只用嚴格大於，五百這個點反而被留在外面。兩個符號只差一點點，但顧客實際付的錢就不一樣。','Look at the point at five hundred. An inclusive boundary puts it in the free-delivery region. A strict greater-than comparison leaves it outside. A small symbol change makes a real difference to the customer.',rule({inclusive:true,focus:500,equation:'500 ≥ 500 is true; 500 > 500 is false'})),
    ],{formula:example.formula}),
    chapter('predict','Predict the boundary case','Reason about the condition before running it.',[
      cue('What happens to exactly 500 under a strict comparison?','現在假設原本的程式寫的是，金額大於五百才免運。把五百代進去，五百有比五百大嗎？先別急著修，請預測它最後會回傳多少運費。','Suppose the original code grants free delivery only when the total is strictly greater than five hundred. Substitute exactly five hundred. Is five hundred greater than itself? Predict the returned fee before fixing anything.',rule({inclusive:false,focus:500,annotation:'Predict the original code, not the intended rule.'})),
    ],{checkpoint:{question:'What fee does the original strict > condition produce at 500?',choices:['0','60','It raises an error'],correct:1,explanation:'500 > 500 is false, so this function reaches the return-60 branch.'}}),
    chapter('diagnosis','The code follows the wrong boundary rule','A valid execution can still violate the requirement.',[
      cue('The condition is false, so execution reaches the paid branch.','它會回傳六十。程式沒有壞掉，也沒有拋例外，而是很正常地照著錯的條件走。因為五百大於五百是假的，所以它跳過免運分支，走到收費。這也解釋了為什麼只看「程式有跑完」不夠。','It returns sixty. The program does not crash; it faithfully executes the wrong condition. Five hundred is not greater than itself, so execution skips the free-delivery branch. Finishing without an exception is not enough.',{type:'code',line:2,annotation:'The program runs; the contract is still violated.'}),
      cue('Change the comparison, while preserving the requirement and tests.','修正時要改的是比較條件，不是把測試的預期改成六十。我們的目標是讓程式符合「滿五百免運」，不是讓錯的程式也能得到通過的標籤。','Change the comparison, not the expected fee. Our goal is to make the implementation satisfy the free-delivery promise, not to redefine the tests so the incorrect code looks successful.',rule({inclusive:true,focus:500,annotation:'Preserve the intent and the expected values.'})),
    ]),
    chapter('repair','Make the boundary inclusive','Choose tests on both sides and at the boundary.',[
      cue('Include equality in the free-delivery branch.','把條件改成大於等於，就會把五百本身也包含進來。四百九十九仍然收六十，五百和五百零一則回傳零。這三個值不是隨便挑的，而是專門卡在門檻前、門檻上、門檻後。','Use greater than or equal to include the threshold. Four ninety-nine still pays sixty, while five hundred and five hundred and one return zero. Those values deliberately test below, at, and above the boundary.',{type:'code',line:2,repaired:true,annotation:'if total >= 500:'}),
      cue('A three-point boundary check can expose a one-symbol error.','下次遇到最低年齡、庫存數量，或訂位容量，也可以用這個三點檢查法。先找臨界值，再看少一點、剛好、和多一點。這通常比隨機測一個很大的數字，更容易抓到這類錯誤。','For minimum ages, inventory, or reservation limits, find the threshold and test just below, exactly at, and just above it. That is often more informative than testing one random large value.',rule({inclusive:true,annotation:'Below / exactly at / above'})),
    ],{kind:'repair'}),
    chapter('evidence','Check the repair with actual execution','A repair is a hypothesis until the unchanged cases run.',[
      cue('Compare unchanged tests before and after.','最後用相同的三個測試重新執行。原本只有五百這個案例失敗，修正後三個都通過。請把結果和剛才的推理對起來：程式之所以改對，不是因為畫面變綠，而是它現在包含了需求要求的邊界。','Run the same three tests again. The original implementation failed at exactly five hundred; the repair passes all three. Connect the evidence to the reasoning: it includes the boundary required by the contract.',{type:'evidence'}),
      cue('Keep the limit of the evidence explicit.','不過，三個通過的測試，只支持這三個輸入。其他型別、負數或不同幣值，這一課都沒有驗證。先把承諾的範圍說清楚，再逐步增加測試，這就是有證據的除錯。','These passing tests support these three inputs. This lesson does not verify other types, negative values, or currency handling. State the scope clearly, then add evidence for any broader promise.',{type:'evidence',annotation:'Constant work: O(1) time and O(1) auxiliary space.'}),
    ],{kind:'outcome'}),
  ];
}

export function buildTeacherStoryboard({example,before,after,report}){
  const frames=(example.id==='binary-last'?binary(example):example.id==='mean-empty'?mean(example):delivery(example));
  const observed=report.before.evidence.results[example.caseIndex],fixed=report.after.evidence;
  for(const frame of frames){
    frame.evidenceLabel='Teacher-led explanation · Authored illustration';
    frame.code=frame.kind==='repair' || frame.kind==='outcome'?example.repair:example.code;
    if(frame.kind==='repair' || frame.kind==='outcome'){frame.summary=after.context.summary;frame.sourceId=after.context.sourceId;frame.createdAt=after.context.createdAt;}
    if(frame.teaching.cues.some(item=>item.scene.type==='evidence')){
      frame.evidenceLabel='Recorded before/after evidence';
      frame.teaching.evidence={before:report.before.evidence,after:fixed,cases:structuredClone(example.cases),functionName:example.functionName};
    }
    // The diagnosis is an explanation; these pointers expose the actual saved
    // run separately rather than passing an illustration off as a trace.
    frame.teaching.observed={beforeSource:before.context.sourceId,afterSource:after.context.sourceId,status:observed.status};
  }
  return {...before,exampleId:example.id,lessonVersion:teacherLessonVersion,context:{...before.context,repairCode:example.repair,teacherLed:true,lessonTitle:example.title},frames};
}

export function narrationSegments(deck,index,language){const frame=deck.frames[index];return frame.teaching?.cues.map(item=>language==='zh-TW'?item.zh:item.en) || null;}
export function teacherCueAt(cueTimes,time,count){
  if(!Array.isArray(cueTimes) || cueTimes.length!==count || !Number.isFinite(time))return null;
  if(cueTimes.some((value,index)=>!Number.isFinite(value) || value<0 || (index && value<=cueTimes[index-1])))return null;
  let index=0;while(index+1<cueTimes.length && cueTimes[index+1]<=time)index++;return index;
}
