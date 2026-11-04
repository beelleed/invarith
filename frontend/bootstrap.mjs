import {mountAuthentication,mountPublicPreview} from './react-shell.mjs';
import {installAccountScope,accountSignal} from './account-scope.mjs';
import {t} from './i18n.mjs';
document.body.classList.add('auth-loading');
const loading=document.createElement('div');loading.id='auth-root';loading.className='auth-opening';loading.textContent=t('Opening your workspace…');document.body.prepend(loading);
try{
 const params=new URLSearchParams(location.search);
 if(params.get('preview')==='1'&&!params.has('auth')){mountPublicPreview();}
 else{
 const response=await fetch('/api/auth/session',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(t('Could not check your account. Reload to try again.'));const session=await response.json();
 if(session.authRequired===false){await import('./app.js');loading.remove();document.body.classList.remove('auth-loading');}
 else if(session.user){const scope=installAccountScope(session.user.id,window,session.user.workspaceVersion||0);globalThis.invarithAccount=session.user;globalThis.invarithAccountSignal=scope.signal;await import('./app.js');loading.remove();document.body.classList.remove('auth-loading');}
 else{window.addEventListener('storage',event=>{if(event.key===accountSignal)location.reload();});if(['login','register','recover','email-recover'].includes(new URLSearchParams(location.search).get('auth')))mountAuthentication();else mountPublicPreview();}
 }
}catch(error){if(new URLSearchParams(location.search).has('auth'))mountAuthentication(error.message);else mountPublicPreview();}
