import { messages } from './locales/zh-TW.mjs';

// A locale owns its page URL, voice defaults and independent preferences.
export const locales = {
  en: { label: 'English', path: '/en/', htmlLanguage: 'en', speech: 'en-US', engine: 'kokoro' },
  'zh-TW': { label: '繁體中文', path: '/zh-TW/', htmlLanguage: 'zh-Hant', speech: 'zh-TW', engine: 'taiwan' },
};
export function resolveLocale(path = '') { return path.startsWith('/zh-TW') ? 'zh-TW' : 'en'; }
export const locale = typeof document === 'undefined' ? 'en' : resolveLocale(globalThis.location?.pathname);
export const language = locales[locale];
export function translate(source, values = [], target = locale) {
  if (typeof source !== 'string') return source == null ? '' : String(source);
  const pattern = target === 'zh-TW' ? messages[source] ?? source : source;
  return pattern.replace(/\{(\d+)\}/g, (_, index) => String(values[index] ?? `{${index}}`));
}
export const t = (source, ...values) => translate(source, values);
export const preferenceKey = name => `${name}:${locale}`;
export function voiceSettings(target, origin = 'example', preferred) {
  const config = locales[target] || locales.en;
  const allowed = target === 'zh-TW' && origin === 'example' ? ['taiwan','kokoro','browser'] : ['kokoro','browser'];
  return { speech:config.speech, engine:allowed.includes(preferred) ? preferred : allowed.includes(config.engine) ? config.engine : 'kokoro' };
}

// Only presentation metadata is translated. Contracts, source code, execution
// values and authored narration remain byte-for-byte unchanged.
const presentationKeys = new Set(['title', 'caption', 'note', 'annotation', 'equation', 'question', 'label', 'explanation', 'description', 'tag', 'sourceLabel', 'evidenceLabel', 'outcome', 'traceNote', 'timingNote', 'lessonTitle']);
const evidenceKeys = new Set(['code','repair','repairCode','intent','variables','changes','actual','expected','value','cases','results','before','after','narration','narrationZh','en','zh']);
export function localizePresentation(value, target = locale) {
  if (Array.isArray(value)) return value.map(item=>localizePresentation(item,target));
  if (!value || typeof value !== 'object') return value;
  const text = source => translate(source,[],target);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    evidenceKeys.has(key) ? item
    : presentationKeys.has(key) && typeof item === 'string' ? text(item)
    : key === 'choices' && Array.isArray(item) ? item.map(choice => typeof choice === 'string' ? text(choice) : localizePresentation(choice,target))
    : key === 'formula' && item ? { ...item, expression:text(item.expression), symbols:item.symbols.map(([symbol,meaning])=>[symbol,text(meaning)]), steps:item.steps.map(step=>text(step)) }
    : localizePresentation(item,target)]));
}

export function initLanguageLinks() {
  if (typeof document === 'undefined') return;
  const brand = document.querySelector('.brand');
  if (brand) brand.href = language.path;
  for (const link of document.querySelectorAll('[data-language]')) {
    const config = locales[link.dataset.language];
    if (!config) continue;
    link.href = config.path + globalThis.location.hash;
    if (link.dataset.language === locale) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', () => { link.href = config.path + globalThis.location.hash; });
  }
}
