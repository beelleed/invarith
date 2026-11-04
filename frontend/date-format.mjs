import {locale} from './i18n.mjs';
const tag=target=>target==='zh-TW'?'zh-TW':'en-US';
const parse=value=>new Date(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00':value);
const pad=value=>String(value).padStart(2,'0');
const datePart=date=>`${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())}`;
const timePart=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
export function formatDate(value,target=locale){const date=parse(value);return Number.isNaN(date.getTime())?'—':target==='zh-TW'?datePart(date):new Intl.DateTimeFormat(tag(target),{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function formatDateTime(value,target=locale){const date=parse(value);return Number.isNaN(date.getTime())?'—':target==='zh-TW'?`${datePart(date)} ${timePart(date)}`:new Intl.DateTimeFormat(tag(target),{year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(date);}
export function formatTime(value,target=locale){const date=parse(value);return Number.isNaN(date.getTime())?'—':target==='zh-TW'?timePart(date):new Intl.DateTimeFormat(tag(target),{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).format(date);}
