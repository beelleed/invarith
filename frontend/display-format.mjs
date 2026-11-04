// A single text node keeps spaces intact in both inline and flex layouts.
export const formatRatio=(value,total)=>`${value} / ${total}`;
export const formatMeta=values=>values.filter(value=>value!==null&&value!==undefined&&String(value).trim()!=='').join(' · ');
export const formatLabeledValue=(label,value,separator=': ')=>`${label}${separator}${value??'—'}`;
