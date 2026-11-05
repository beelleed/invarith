import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {TestCaseEditor} from './TestCaseEditor.jsx';

// Keep the legacy interview draft as the source of truth for saving and running.
export function InterviewTestCases(){
 const [host,setHost]=useState(null),[snapshot,setSnapshot]=useState(null);
 useEffect(()=>{
  const source=document.getElementById('interview-cases');if(!source)return;
  const mount=document.createElement('div');source.before(mount);source.hidden=true;
  const label=document.querySelector('label[for="interview-cases"]');if(label)label.hidden=true;
  const sync=event=>setSnapshot(event.detail);
  document.addEventListener('interview-cases-updated',sync);setHost(mount);
  document.dispatchEvent(new Event('interview-cases-ready'));
  return()=>{document.removeEventListener('interview-cases-updated',sync);mount.remove();source.hidden=false;if(label)label.hidden=false;};
 },[]);
 return host&&snapshot?createPortal(<TestCaseEditor key={snapshot.id} label="Interview test cases" value={snapshot.value} code={snapshot.code} functionName={snapshot.functionName} disabled={snapshot.disabled} onChange={value=>{const source=document.getElementById('interview-cases');source.value=value;source.dispatchEvent(new Event('input',{bubbles:true}));setSnapshot(previous=>({...previous,value}));}}/>,host):null;
}
