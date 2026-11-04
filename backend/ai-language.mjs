import OpenCC from 'opencc-js';
import {AppError} from './verification.mjs';
const toTraditional=OpenCC.Converter({from:'cn',to:'tw'});
export function responseLanguage(value){const language=value===undefined?'en-US':value;if(!['en-US','zh-TW'].includes(language))throw new AppError(400,'Choose English or Traditional Chinese.');return language;}
export function traditionalProse(text,language){if(language!=='zh-TW'||typeof text!=='string')return text;return text.split(/(```[\s\S]*?```|`[^`\n]*`)/g).map((part,i)=>i%2?part:toTraditional(part)).join('');}
export function planProse(plan,language){return {...plan,language,summary:traditionalProse(plan.summary,language),assumptions:plan.assumptions.map(s=>traditionalProse(s,language)),questions:plan.questions.map(s=>traditionalProse(s,language)),hypotheses:plan.hypotheses.map(h=>({...h,claim:traditionalProse(h.claim,language),basis:traditionalProse(h.basis,language)})),candidates:plan.candidates.map(c=>({...c,title:traditionalProse(c.title,language),rationale:traditionalProse(c.rationale,language)}))};}
export function oralReviewProse(review,language){return review?{...review,strength:traditionalProse(review.strength,language),followUp:traditionalProse(review.followUp,language),hint:traditionalProse(review.hint,language),criteria:review.criteria.map(c=>({...c,note:traditionalProse(c.note,language)}))}:review;}
