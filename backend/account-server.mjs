import http from 'node:http';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readdir} from 'node:fs/promises';
import {createApp} from './app-server.mjs';
import {createAuthStore} from './auth-store.mjs';
import {createHistoryStore} from './history.mjs';
import {createInterviewStore} from './interview-store.mjs';
import {createLocalVoice} from './local-voice.mjs';
import {AppError} from './verification.mjs';
import {createAccountMailer} from './account-mailer.mjs';
const defaultData=fileURLToPath(new URL('../data/',import.meta.url));
const cookieName='invarith_session';
export function accountWorkspaceDirectory(directory,user){const root=resolve(directory,'users',user.id),version=user.workspaceVersion||0;return version?join(root,'workspaces',String(version)):root;}
export function configuredOrigin(value){if(!value)return null;const url=new URL(value);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!['http:','https:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('APP_ORIGIN must be an HTTPS origin, or a loopback HTTP origin for local development.');return url.origin;}
export function createAccountApp({directory=defaultData,mailer=createAccountMailer(),auth=createAuthStore({directory:join(directory,'accounts'),sendEmail:mailer.ready?mailer.send:null}),origin=configuredOrigin(process.env.APP_ORIGIN),appOptions={},factory=createApp,clientAddress=req=>req.socket.remoteAddress}={}){
 const applications=new Map(),common=factory({...appOptions,publicOrigin:origin});
 const token=req=>{const values=(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));return values.length===1?values[0].slice(cookieName.length+1):null;};
 const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
 const setCookie=(req,res,value,maxAge)=>res.setHeader('Set-Cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${origin?.startsWith('https:')||req.socket.encrypted?'; Secure':''}`);
 const expectedOrigin=req=>origin||`http://${req.headers.host}`;
 const verifyOrigin=req=>{if(req.headers.origin!==expectedOrigin(req))throw new AppError(403,'Submissions from other sites are not accepted.');};
 const body=async req=>{if(!req.headers['content-type']?.startsWith('application/json'))throw new AppError(415,'Submit the request as JSON.');req.setEncoding('utf8');let value='',length=0;for await(const chunk of req){length+=Buffer.byteLength(chunk);if(length>8192)throw new AppError(413,'Account request is too large.');value+=chunk.toString('utf8');}let data;try{data=JSON.parse(value);}catch{throw new AppError(400,'Invalid JSON.');}if(!data||typeof data!=='object'||Array.isArray(data))throw new AppError(400,'Submit a JSON object.');return data;};
 const userApp=user=>{const cacheKey=user.id+':'+(user.workspaceVersion||0);let entry=applications.get(cacheKey);if(entry){entry.lastUsed=Date.now();return entry;}if(applications.size>=64){const candidate=[...applications].filter(([,entry])=>entry.inflight===0).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];if(!candidate)throw new AppError(503,'The workspace is busy. Try again shortly.');candidate[1].app.emit('close');applications.delete(candidate[0]);}
  if(!/^[a-f0-9-]{36}$/.test(user.id)||!Number.isSafeInteger(user.workspaceVersion||0)||(user.workspaceVersion||0)<0)throw new AppError(401,'Sign in to continue.');const root=accountWorkspaceDirectory(directory,user);
  entry={lastUsed:Date.now(),inflight:0,app:factory({...appOptions,publicOrigin:origin,practiceService:undefined,dataDirectory:root,designDirectory:join(root,'system-design'),practiceDirectory:join(root,'ai-practice'),listsDirectory:join(root,'practice-lists'),notesDirectory:join(root,'practice-notes'),assessmentDirectory:join(root,'assessments'),debugJournalDirectory:join(root,'debug-journal'),oralStore:createInterviewStore(join(root,'oral-practice')),interviewStore:createInterviewStore(join(root,'interviews')),history:createHistoryStore(join(root,'history')),projectHistory:createHistoryStore(join(root,'projects')),localVoice:appOptions.localVoiceFactory?appOptions.localVoiceFactory(root):createLocalVoice({directory:join(root,'local-voice'),readinessDirectory:join(directory,'local-voice')})})};applications.set(cacheKey,entry);return entry;
 };
 const delegate=(app,req,res)=>app.emit('request',req,res);
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   if(origin?req.headers.host!==new URL(origin).host:!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host||''))throw new AppError(403,'Open this workspace using its configured address.');
   const path=new URL(req.url,expectedOrigin(req)).pathname;
   if(!path.startsWith('/api/')){delegate(common,req,res);return;}
   const oldToken=token(req);
   if(path==='/api/auth/email-status'&&req.method==='GET'){send(res,200,{ready:mailer.ready});return;}
   if(path==='/api/auth/email-reset/request'&&req.method==='POST'){verifyOrigin(req);send(res,200,await auth.requestEmailReset(await body(req),clientAddress(req)));return;}
   if(path==='/api/auth/email-reset/confirm'&&req.method==='POST'){verifyOrigin(req);const result=await auth.confirmEmailReset(await body(req),clientAddress(req));await auth.revoke(oldToken);setCookie(req,res,'',0);send(res,200,result);return;}
   if(path==='/api/auth/session'&&req.method==='GET'){const user=await auth.authenticate(oldToken);send(res,200,{authRequired:true,user});return;}
   if(['/api/auth/register','/api/auth/login'].includes(path)&&req.method==='POST'){
    verifyOrigin(req);const input=await body(req),result=path.endsWith('/register')?await auth.register(input,clientAddress(req)):await auth.login(input,clientAddress(req));await auth.revoke(oldToken);setCookie(req,res,result.token,result.maxAge);send(res,200,{user:result.user,...(result.recoveryKey?{recoveryKey:result.recoveryKey}:{})});return;
   }
   if(path==='/api/auth/recover'&&req.method==='POST'){verifyOrigin(req);const result=await auth.recover(await body(req),clientAddress(req));await auth.revoke(oldToken);setCookie(req,res,'',0);send(res,200,result);return;}
   const user=await auth.authenticate(oldToken);if(!user){send(res,401,{error:'Sign in to continue.',code:'AUTH_REQUIRED'});return;}
   if((req.method!=='GET'&&req.method!=='HEAD'||req.headers['x-invarith-user'])&&req.headers['x-invarith-user']!==user.id){send(res,409,{error:'Your signed-in account changed. Reload to continue.',code:'AUTH_ACCOUNT_CHANGED'});return;}
   if((req.method!=='GET'&&req.method!=='HEAD'||req.headers['x-invarith-user'])&&String(user.workspaceVersion||0)!==(req.headers['x-invarith-workspace']||'0')){send(res,409,{error:'Your practice workspace changed. Reload before continuing.',code:'AUTH_WORKSPACE_CHANGED'});return;}
   if(req.method!=='GET'&&req.method!=='HEAD')verifyOrigin(req);
   if(path==='/api/auth/email-verification/request'&&req.method==='POST'){send(res,200,await auth.requestEmailVerification(user.id,await body(req),clientAddress(req)));return;}
   if(path==='/api/auth/email-verification/confirm'&&req.method==='POST'){send(res,200,await auth.confirmEmailVerification(user.id,await body(req),clientAddress(req)));return;}
   if(path==='/api/auth/logout'&&req.method==='POST'){await auth.revoke(oldToken);setCookie(req,res,'',0);send(res,200,{signedOut:true});return;}
   if(path==='/api/auth/password'&&req.method==='POST'){const result=await auth.changePassword(user.id,await body(req),clientAddress(req));setCookie(req,res,result.token,result.maxAge);send(res,200,{user:result.user});return;}
   if(path==='/api/auth/recovery-key'&&req.method==='POST'){send(res,200,await auth.recoveryKey(user.id,await body(req),clientAddress(req)));return;}
   if(path==='/api/auth/email'&&req.method==='POST'){const result=await auth.changeEmail(user.id,await body(req),clientAddress(req));await auth.revoke(oldToken);setCookie(req,res,result.token,result.maxAge);send(res,200,{user:result.user});return;}
   if(path==='/api/auth/workspaces'&&req.method==='GET'){const current=accountWorkspaceDirectory(directory,user),counts={};for(const folder of ['ai-practice','history','interviews','system-design','practice-notes','solution-lessons']){try{counts[folder]=(await readdir(join(current,folder))).filter(name=>/^[a-f0-9-]{36}\.json$/.test(name)||folder==='solution-lessons'&&/^[a-f0-9]{64}\.json$/.test(name)).length;}catch(e){if(e.code!=='ENOENT')throw e;counts[folder]=0;}}send(res,200,{...await auth.workspaces(user.id),counts});return;}
   if(path==='/api/auth/workspace'&&req.method==='POST'){send(res,200,{user:await auth.changeWorkspace(user.id,await body(req),clientAddress(req))});return;}
   if(path.startsWith('/api/auth/'))throw new AppError(404,'Page not found.');
   const entry=userApp(user);entry.inflight++;let completed=false;const complete=()=>{if(!completed){completed=true;entry.inflight--;}};res.once('finish',complete);res.once('close',complete);delegate(entry.app,req,res);
  }catch(error){if(!res.headersSent)send(res,error.status||500,{error:error.status?error.message:'An account request failed. Please try again.'});else res.end();}
 });
 server.on('close',()=>{common.emit('close');for(const entry of applications.values())entry.app.emit('close');applications.clear();});return server;
}
