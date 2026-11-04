import React from 'react';
import {t} from '../i18n.mjs';
import {parameterNames} from './TestCaseEditor.jsx';

export function ReadableValue({value}){
  if(Array.isArray(value))return value.length?<div className="readable-value-list">{value.map((item,index)=><span key={index}><ReadableValue value={item}/></span>)}</div>:<span className="readable-empty-list">{t('Empty list')}</span>;
  if(value!==null&&typeof value==='object')return <dl className="readable-value-object">{Object.entries(value).map(([key,item])=><div key={key}><dt>{key}</dt><dd><ReadableValue value={item}/></dd></div>)}</dl>;
  if(typeof value==='string')return <q className="readable-value-text">{value}</q>;
  return <code>{value===undefined?t('No return value'):value===null?'null':String(value)}</code>;
}

export function ReadableCases({cases=[],functionName,code='',showActual=false}){
  const names=parameterNames(code,functionName);
  return <ol className="readable-cases">{cases.map((item,index)=><li key={index}><header><strong>{t('Test case {0}',index+1)}</strong><code>{functionName}</code></header><div className="readable-case-inputs"><h5>{t('Inputs')}</h5><dl>{(item.args||[]).map((value,i)=><div key={'arg'+i}><dt>{names[i]||t('Input {0}',i+1)}</dt><dd><ReadableValue value={value}/></dd></div>)}{Object.entries(item.kwargs||{}).map(([key,value])=><div key={'kw'+key}><dt>{key}</dt><dd><ReadableValue value={value}/></dd></div>)}</dl></div><div className="readable-case-expected"><h5>{t('Expected return value')}</h5><ReadableValue value={item.expected}/></div>{showActual&&<div className="readable-case-actual"><h5>{t('Actual return value')}</h5>{item.error?<p className="readable-case-error">{item.error}</p>:<ReadableValue value={item.actual}/>}</div>}</li>)}</ol>;
}
