import {AppError,validateSubmission} from './verification.mjs';
const reserved=new Set(['sys','os','json','time','types','importlib','contextlib','io','builtins','site','traceback','collections','math','random','re','pathlib','typing','unittest','submission','runner']);
export function validateProject(body){
  if(!body||typeof body.files!=='object'||!body.files||Array.isArray(body.files))throw new AppError(400,'Provide a Python project with 1 to 5 files.');
  const entries=Object.entries(body.files);if(!entries.length||entries.length>5)throw new AppError(400,'Provide a Python project with 1 to 5 files.');
  let size=0;const files={};
  for(const[name,code]of entries){if(!/^[a-z][a-z0-9_]{0,39}\.py$/.test(name)||reserved.has(name.slice(0,-3)))throw new AppError(400,'Use flat Python filenames without paths or standard-library names.');if(typeof code!=='string'||code.length>12000)throw new AppError(400,'Each file must contain at most 12,000 characters.');size+=code.length;files[name]=code;}
  if(size>24000)throw new AppError(400,'Project source must total at most 24,000 characters.');
  if(typeof body.entryFile!=='string'||!Object.hasOwn(files,body.entryFile))throw new AppError(400,'Choose an existing entry file.');
  const submission=validateSubmission({code:files[body.entryFile],functionName:body.functionName,cases:body.cases,intent:body.intent});
  return {...submission,files,entryModule:body.entryFile.slice(0,-3)};
}
