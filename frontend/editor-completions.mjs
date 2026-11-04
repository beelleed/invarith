import {t} from './i18n.mjs';
import {syntaxTree} from '@codemirror/language';

const keywords={
 python:'def class if elif else for while in not and or return yield break continue pass try except finally raise with as lambda import from None True False async await',
 javascript:'function const let var if else for while return break continue try catch finally throw class new async await null true false import export switch case',
 typescript:'function const let if else for while return class new async await interface type enum extends implements public private readonly number string boolean unknown null true false import export',
 java:'class public private protected static final int long double boolean String void if else for while return new null true false import package try catch throw',
 cpp:'auto bool int long double char void string vector const return if else for while switch case break continue struct class public private using namespace nullptr true false include',
 c:'int long double char void const return if else for while switch case break continue struct typedef enum sizeof NULL include',
 csharp:'class public private protected static readonly int long double bool string void var if else foreach for while return new null true false using namespace try catch throw',
 go:'package import func var const type struct interface if else for range return break continue switch case defer go nil true false make append len cap',
 rust:'fn let mut const pub struct enum impl trait use mod if else match for while loop in return break continue Some None Ok Err true false Vec String Option Result',
 kotlin:'fun val var class object interface if else when for while return in null true false Int Long Double Boolean String Array IntArray List MutableList',
 ruby:'def end class module if elsif else unless while until for in do return break next begin rescue ensure raise require nil true false',
 php:'function class public private static if elseif else foreach for while return break continue try catch throw new null true false echo require include'
};
const builtins={python:'len range enumerate zip sorted reversed sum min max abs all any print int float str list dict set tuple bool isinstance map filter round',javascript:'Array Map Set Math JSON Number String Boolean Object Promise console parseInt parseFloat Infinity',typescript:'Array Map Set Math JSON Number String Boolean Object Promise console Record Partial Readonly',java:'Arrays Collections ArrayList HashMap HashSet LinkedList ArrayDeque PriorityQueue Math StringBuilder Integer Long',cpp:'sort stable_sort reverse lower_bound upper_bound binary_search accumulate min max swap vector string unordered_map unordered_set map set queue stack deque priority_queue pair',csharp:'Array List Dictionary HashSet Queue Stack Math String Console',go:'append len cap make copy delete panic recover',rust:'Vec String HashMap HashSet VecDeque BinaryHeap println format vec',kotlin:'mutableListOf listOf mutableMapOf mapOf mutableSetOf setOf intArrayOf arrayOf maxOf minOf println',ruby:'puts print Array Hash Set Integer Float String',php:'count strlen array_map array_filter array_reduce array_search sort usort min max abs intdiv json_encode json_decode'};
const modules={python:['collections','heapq','bisect','math','itertools','functools'],javascript:['node:assert','node:util','node:buffer'],typescript:['node:assert','node:util','node:buffer'],go:['fmt','sort','slices','strings','strconv','math','container/heap'],rust:['std::collections','std::cmp','std::mem','serde_json'],java:['java.util','java.lang','com.google.gson'],csharp:['System','System.Collections.Generic','System.Linq','Newtonsoft.Json.Linq'],kotlin:['kotlin.math','java.util','com.google.gson'],ruby:['set','json'],php:[],cpp:['vector','algorithm','numeric','unordered_map','unordered_set','queue','stack'],c:['stdio.h','stdlib.h','string.h','math.h','cjson/cJSON.h']};
const members={
 collections:['deque','Counter','defaultdict','OrderedDict','namedtuple'],heapq:['heappush','heappop','heapify','heappushpop','heapreplace','nlargest','nsmallest'],bisect:['bisect_left','bisect_right','insort_left','insort_right'],math:['gcd','lcm','sqrt','floor','ceil','inf','isfinite','factorial'],itertools:['accumulate','combinations','permutations','product','chain'],functools:['lru_cache','cache','reduce','cmp_to_key'],
 Math:['abs','floor','ceil','round','min','max','sqrt','pow','trunc'],JSON:['parse','stringify'],console:['log','error','warn'],Arrays:['sort','binarySearch','fill','copyOf','equals'],Collections:['sort','reverse','min','max'],fmt:['Println','Printf','Sprintf'],sort:['Ints','Strings','Search','Slice','SliceStable'],strings:['Contains','Split','Join','ToLower','ToUpper','TrimSpace'],strconv:['Itoa','Atoi','ParseInt'],std:['collections','cmp','mem'],serde_json:['Value','json','from_value','to_value','from_str','to_string'],Array:['IndexOf','Sort','Reverse','BinarySearch']
};
const memberLanguages={python:['collections','heapq','bisect','math','itertools','functools'],javascript:['Math','JSON','console'],typescript:['Math','JSON','console'],java:['Math','Arrays','Collections'],csharp:['Math','Array'],go:['fmt','sort','strings','strconv'],rust:['std','serde_json']};

export function editorCompletionSource(language){return context=>{
 const word=context.matchBefore(/\w*$/),from=word?.from??context.pos,prefix=context.state.doc.sliceString(Math.max(0,from-120),from);
 const node=syntaxTree(context.state).resolveInner(context.pos,-1);if(/comment|string/i.test(node.name)&&!/(?:import|require|include)\b/.test(context.state.doc.lineAt(context.pos).text))return null;
 if(!context.explicit&&(!word||word.text.length<1)&&!/[.:]$/.test(prefix)&&!/(?:import|require)\s+$/.test(prefix))return null;
 const qualifier=prefix.match(/([A-Za-z_]\w*)[.:]+$/)?.[1];
 let owner=qualifier;
 if(language==='python'&&qualifier){const escaped=qualifier.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),alias=context.state.doc.toString().match(new RegExp('import\\s+(\\w+)\\s+as\\s+'+escaped+'\\b'));if(alias)owner=alias[1];}
 const allowed=memberLanguages[language]||[],member=language==='go'&&owner==='math'?['Min','Max','Abs','Sqrt','Floor','Ceil','Inf','IsNaN','IsInf','Pow']:language==='csharp'&&owner==='Math'?['Abs','Floor','Ceiling','Round','Min','Max','Sqrt','Pow']:language==='cpp'&&owner==='std'?(builtins.cpp||'').split(' '):language==='rust'&&owner==='collections'?['HashMap','HashSet','VecDeque','BinaryHeap']:allowed.includes(owner)&&members[owner];
 const importOwner=language==='python'?prefix.match(/from\s+(\w+)\s+import\s+$/)?.[1]:null;
 const imported=importOwner&&allowed.includes(importOwner)&&members[importOwner];
 const options=(member||imported)?(member||imported).map(label=>({label,type:'function',detail:owner||importOwner})):qualifier?[]:[...(keywords[language]||'').split(' ').filter(Boolean).map(label=>({label,type:'keyword'})),...(builtins[language]||'').split(' ').filter(Boolean).map(label=>({label,type:'function',detail:t('Standard library')})),...(modules[language]||[]).filter(label=>!(language==='go'&&label==='slices')).map(label=>({label,type:'namespace',detail:t('Module')})),...[...new Set(context.state.doc.toString().match(/\b[A-Za-z_]\w*\b/g)||[])].slice(0,1000).map(label=>({label,type:'variable',detail:t('In this file')}))];
 return {from,options:[...new Map(options.map(option=>[option.label,option])).values()],validFor:/^\w*$/};
};}
