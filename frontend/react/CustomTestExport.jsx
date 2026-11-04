import React,{useEffect,useRef,useState} from 'react';
import {t} from '../i18n.mjs';
export function CustomTestExport({session,code,outcome,busy,onBusy}){
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),alive=useRef(true),locked=useRef(false),url=useRef(null),timer=useRef(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);if(url.current)URL.revokeObjectURL(url.current);};},[]);
  const download=async()=>{if(busy||locked.current)return;locked.current=true;onBusy(true);setError('');setNotice('');
    try{const response=await fetch('/api/practice/export-custom-tests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:session.id,revision:session.customTests.revision,runId:outcome.id,code}),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Could not export your custom tests.');if(!alive.current)return;
      if(timer.current)clearTimeout(timer.current);if(url.current)URL.revokeObjectURL(url.current);url.current=URL.createObjectURL(new Blob([value.source],{type:'text/x-python;charset=utf-8'}));const link=document.createElement('a');link.href=url.current;link.download=value.filename;document.body.append(link);link.click();link.remove();timer.current=setTimeout(()=>{if(url.current){URL.revokeObjectURL(url.current);url.current=null;}},10000);setNotice(t('Test file prepared with {0} custom cases. Run it in an isolated Python 3.12 environment.',value.caseCount));
    }catch(e){if(alive.current)setError(t(e.message));}finally{locked.current=false;onBusy(false);}
  };
  return <div className="custom-test-export"><button className="text-button" disabled={busy} onClick={()=>void download()}>{t('Download runnable custom tests · No AI')}</button><small>{t('One Python file with this tested code and your custom expectations. Running it executes the saved code; it does not change your Invarith records.')}</small>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</div>;
}
