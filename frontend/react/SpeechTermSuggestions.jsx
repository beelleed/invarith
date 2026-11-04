import React,{useState} from 'react';
import {t} from '../i18n.mjs';
import {speechTermSuggestions,applySpeechTermSuggestion} from '../speech-term-suggestions.mjs';
export function SpeechTermSuggestions({value,onChange,disabled=false}){
 const [undo,setUndo]=useState(null),suggestions=speechTermSuggestions(value);
 if(!suggestions.length&&value!==undo?.after)return null;
 return <section className="speech-term-suggestions" aria-label={t('Review recognized terms')}><strong>{t('Did you mean these programming terms?')}</strong><p>{t('These are optional suggestions. Your transcript changes only when you select one.')}</p><div>{suggestions.map(s=><button type="button" className="text-button" key={s.start+':'+s.replacement} disabled={disabled} onClick={()=>{const next=applySpeechTermSuggestion(value,s);setUndo({before:value,after:next});onChange(next);}}>{s.heard} → {s.replacement}</button>)}{value===undo?.after&&<button type="button" className="text-button" disabled={disabled} onClick={()=>{onChange(undo.before);setUndo(null);}}>{t('Undo term correction')}</button>}</div></section>;
}
