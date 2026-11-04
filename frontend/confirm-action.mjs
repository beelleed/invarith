import {t} from './i18n.mjs';

let pending=false;
// An in-page dialog also works where browser-native confirm() is suppressed.
export function confirmAction(message){
 if(pending)return Promise.resolve(false);
 pending=true;
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='confirm-action-dialog';dialog.setAttribute('aria-labelledby','confirm-action-title');
  const heading=document.createElement('h2');heading.id='confirm-action-title';heading.textContent=t('Confirm removal');
  const description=document.createElement('p');description.textContent=message;
  const actions=document.createElement('div'),cancel=document.createElement('button'),confirm=document.createElement('button');actions.className='confirm-action-buttons';
  cancel.type=confirm.type='button';cancel.textContent=t('Cancel');confirm.textContent=t('Remove');cancel.autofocus=true;confirm.className='confirm-action-remove';
  actions.append(cancel,confirm);dialog.append(heading,description,actions);
  const root=document.querySelector('.studio-app');if(root){const style=getComputedStyle(root);for(const key of ['surface','raised','line','text','muted','accent','warn'])dialog.style.setProperty('--ui-'+key,style.getPropertyValue('--ui-'+key));}
  let settled=false;const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();window.removeEventListener('pagehide',dismiss);pending=false;resolve(value);};
  const dismiss=()=>finish(false);cancel.onclick=dismiss;confirm.onclick=()=>finish(true);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});dialog.addEventListener('close',dismiss);window.addEventListener('pagehide',dismiss);
  document.body.append(dialog);try{dialog.showModal();cancel.focus();}catch{dialog.remove();pending=false;resolve(false);}
 });
}
