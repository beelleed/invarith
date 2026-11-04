export const codeLanguages=[{id:'python',label:'Python 3.12',file:'submission.py'},{id:'javascript',label:'JavaScript · Node 24',file:'submission.cjs'},{id:'typescript',label:'TypeScript 5.9',file:'submission.ts'},{id:'java',label:'Java 17',file:'Solution.java'},{id:'cpp',label:'C++17',file:'submission.cpp'},{id:'go',label:'Go 1.19',file:'submission.go'},{id:'rust',label:'Rust 1.63',file:'submission.rs'},{id:'csharp',label:'C# 7.2',file:'Solution.cs'},{id:'kotlin',label:'Kotlin 1.3',file:'Submission.kt'},{id:'c',label:'C17 · cJSON',file:'submission.c'},{id:'ruby',label:'Ruby 3.1',file:'submission.rb'},{id:'php',label:'PHP 8.2',file:'submission.php'}];
export const languageLabel=id=>codeLanguages.find(item=>item.id===id)?.label||'Python 3.12';
export function languageInstructions(id){return ({
 javascript:'Write the named function and return JSON-compatible values. Async functions are supported.',
 typescript:'TypeScript is checked in strict mode before execution. Fix type errors before running tests.',
 java:'Write the named method inside Solution. Return JSON-compatible values; do not write main.',
 cpp:'Write a free function using standard containers or nlohmann::json. Do not write main.',
 go:'Use package main and write the named function. Do not write main. JSON inputs must match your parameter types.',
 rust:'Write the named function using JSON-compatible scalars, Vec, Option, maps or serde_json::Value. Do not write main.',
 csharp:'Use C# 7.2 syntax and write the named method inside Solution. Newtonsoft.Json is available; do not write Main.',
 kotlin:'Write the named top-level Kotlin function. Gson is available; do not write main.',
 c:'C uses cJSON arguments and returns an owned cJSON value. Use cJSON_CreateNull() for JSON null; do not write main.',
 ruby:'Write the named Ruby method. Return JSON-compatible values; the runner calls it for each case.',
 php:'Start with <?php and write the named function. Return JSON-compatible values; no external packages are loaded.',
 })[id]||'';}
function type(values,language){
 if(['go','rust','csharp','kotlin'].includes(language)){
  if(values.some(v=>v===null))return ({go:'any',rust:'serde_json::Value',csharp:'JToken',kotlin:'JsonElement'})[language];
  if(values.length&&values.every(Array.isArray)){
   const inner=type(values.flat(),language);
   return language==='go'?'[]'+inner:language==='rust'?`Vec<${inner}>`:language==='csharp'?inner+'[]':({Int:'IntArray',Long:'LongArray',Double:'DoubleArray',Boolean:'BooleanArray'})[inner]||`Array<${inner}>`;
  }
  if(values.length&&values.every(v=>typeof v==='number')){const decimal=values.some(v=>!Number.isInteger(v)),wide=values.some(v=>Math.abs(v)>2147483647);return language==='go'?decimal?'float64':'int':language==='rust'?decimal?'f64':wide?'i64':'i32':language==='csharp'?decimal?'double':wide?'long':'int':decimal?'Double':wide?'Long':'Int';}
  if(values.length&&values.every(v=>typeof v==='boolean'))return language==='kotlin'?'Boolean': 'bool';
  if(values.length&&values.every(v=>typeof v==='string'))return language==='rust'||language==='kotlin'?'String':'string';
  return ({go:'any',rust:'serde_json::Value',csharp:'JToken',kotlin:'JsonElement'})[language];
 }
 const present=values.filter(v=>v!==null&&v!==undefined);
 if(present.length&&values.some(v=>v===null)){
  const inner=type(present,language);
  if(language==='cpp')return 'json';
  if(language==='java')return ({int:'Integer',long:'Long',double:'Double',boolean:'Boolean'})[inner]||inner;
  if(language==='typescript')return '('+inner+' | null)';
 }
 if(present.length&&present.every(Array.isArray)){const item=type(present.flat(),language);return language==='java'?item+'[]':language==='cpp'?`vector<${item}>`:item+'[]';}
 if(present.length&&present.every(v=>typeof v==='boolean'))return language==='java'||language==='typescript'?'boolean':'bool';
 if(present.length&&present.every(v=>typeof v==='string'))return language==='java'?'String':'string';
 if(present.length&&present.every(v=>typeof v==='number'))return language==='typescript'?'number':present.some(v=>!Number.isInteger(v))?'double':present.some(v=>Math.abs(v)>2147483647)?language==='java'?'long':'long long':'int';
 return language==='typescript'?'unknown':language==='java'?'JsonElement':language==='cpp'?'json':'unknown';
}
export function languageStarter(language,functionName,cases=[],python=''){
 if(language==='python')return python||`def ${functionName}(*args):\n    raise NotImplementedError("Write your solution")\n`;
 const count=cases[0]?.args?.length||0,args=Array.from({length:count},(_,i)=>({name:'arg'+(i+1),type:type(cases.map(c=>c.args[i]),language)})),result=type(cases.map(c=>c.expected),language);
 if(language==='javascript')return `function ${functionName}(${args.map(a=>a.name).join(', ')}) {\n  throw new Error("Write your solution");\n}\n`;
 if(language==='typescript')return `function ${functionName}(${args.map(a=>a.name+': '+a.type).join(', ')}): ${result} {\n  throw new Error("Write your solution");\n}\n`;
 if(language==='java')return `import java.util.*;\nimport com.google.gson.*;\n\nclass Solution {\n    public static ${result} ${functionName}(${args.map(a=>a.type+' '+a.name).join(', ')}) {\n        throw new UnsupportedOperationException("Write your solution");\n    }\n}\n`;
 if(language==='go')return `package main\n\nfunc ${functionName}(${args.map(a=>a.name+' '+a.type).join(', ')}) ${result} {\n    panic("Write your solution")\n}\n`;
 if(language==='rust')return `fn ${functionName}(${args.map(a=>a.name+': '+a.type).join(', ')}) -> ${result} {\n    todo!("Write your solution")\n}\n`;
 if(language==='csharp')return `using System;\nusing System.Collections.Generic;\nusing Newtonsoft.Json.Linq;\n\nclass Solution {\n    public static ${result} ${functionName}(${args.map(a=>a.type+' '+a.name).join(', ')}) {\n        throw new NotImplementedException("Write your solution");\n    }\n}\n`;
 if(language==='kotlin')return `import com.google.gson.*\n\nfun ${functionName}(${args.map(a=>a.name+': '+a.type).join(', ')}): ${result} {\n    TODO("Write your solution")\n}\n`;
 if(language==='ruby')return `def ${functionName}(${args.map(a=>a.name).join(', ')})\n  raise NotImplementedError, "Write your solution"\nend\n`;
 if(language==='php')return `<?php\nfunction ${functionName}(${args.map(a=>'$'+a.name).join(', ')}) {\n    throw new Exception("Write your solution");\n}\n`;
 if(language==='c')return `#include <cjson/cJSON.h>\n#include <stdlib.h>\n\n/* Read arguments with cJSON helpers. Return an owned cJSON value. */\ncJSON* ${functionName}(${args.length?args.map(a=>'const cJSON* '+a.name).join(', '):'void'}) {\n    return NULL; /* Replace with your solution. Use cJSON_CreateNull() for JSON null. */\n}\n`;
 return `#include <bits/stdc++.h>\n#include <nlohmann/json.hpp>\nusing namespace std;\nusing json = nlohmann::json;\n\n${result} ${functionName}(${args.map(a=>a.type+' '+a.name).join(', ')}) {\n    throw runtime_error("Write your solution");\n}\n`;
}
