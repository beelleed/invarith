import { parse } from 'parse5';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { translate, locales } from '../frontend/i18n.mjs';

export function localizedHTML(source, locale) {
  const tree = parse(source, { sourceCodeLocationInfo: true }), edits = [];
  const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  function visit(node, protectedText = false) {
    const skip = protectedText || ['script','style','pre','code','textarea'].includes(node.tagName) || node.attrs?.some(a => a.name === 'data-no-translate');
    if (node.nodeName === '#text' && !skip && node.value.trim()) {
      const key = node.value.trim(), result = translate(key, [], locale);
      if (result !== key) edits.push({ start: node.sourceCodeLocation.startOffset, end: node.sourceCodeLocation.endOffset, value: escape(node.value.replace(key,result)) });
    }
    if (!skip || node.tagName==='textarea' && !protectedText && !node.attrs?.some(a=>a.name==='data-no-translate')) for (const attr of node.attrs || []) {
      if (!['aria-label','title','placeholder','alt'].includes(attr.name)) continue;
      const result = translate(attr.value, [], locale), location = node.sourceCodeLocation?.attrs?.[attr.name];
      if (location && result !== attr.value) edits.push({ start:location.startOffset,end:location.endOffset,value:`${attr.name}="${escape(result)}"` });
    }
    for (const child of node.childNodes || []) visit(child,skip);
  }
  visit(tree);
  let html = source;
  for (const edit of edits.sort((a,b)=>b.start-a.start)) html = html.slice(0,edit.start)+edit.value+html.slice(edit.end);
  return html.replace('<html lang="en">',`<html lang="${locales[locale].htmlLanguage}" data-locale="${locale}">`);
}
if (process.argv[1]?.endsWith('build-locales.mjs')) {
  const source = await readFile(new URL('../frontend/index.html',import.meta.url),'utf8');
  await mkdir(new URL('../frontend/localized/',import.meta.url),{recursive:true});
  for (const locale of Object.keys(locales)) await writeFile(new URL(`../frontend/localized/${locale}.html`,import.meta.url),localizedHTML(source,locale));
  console.log('Built English and Traditional Chinese pages from the shared template.');
}
