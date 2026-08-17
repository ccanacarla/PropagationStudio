import ptBR from './pt-BR.js';
import en from './en.js';

const STORAGE_KEY = 'propagation-studio-language';
const dictionaries = { 'pt-BR': ptBR, en };
const supported = Object.keys(dictionaries);
let savedLanguage = null;
try { savedLanguage = localStorage.getItem(STORAGE_KEY); } catch {}
let currentLanguage = supported.includes(savedLanguage) ? savedLanguage : 'pt-BR';

function lookup(dictionary, key) {
  return String(key || '').split('.').reduce((value, part) => value?.[part], dictionary);
}

function interpolate(text, variables = {}) {
  return String(text).replace(/\{([^}]+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : `{${key}}`
  );
}

export function t(key, variables = {}) {
  const value = lookup(dictionaries[currentLanguage], key) ?? lookup(dictionaries['pt-BR'], key) ?? key;
  return interpolate(value, variables);
}

export function getLanguage() {
  return currentLanguage;
}

function replaceDirectText(element, text) {
  const textNodes = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
  if (!textNodes.length) {
    element.insertBefore(document.createTextNode(text), element.firstChild);
    return;
  }
  const node = textNodes[0];
  const leading = node.nodeValue.match(/^\s*/)?.[0] ?? '';
  const trailing = node.nodeValue.match(/\s*$/)?.[0] ?? '';
  node.nodeValue = `${leading}${text}${trailing}`;
}

export function translatePage(root = document) {
  document.documentElement.lang = currentLanguage;
  document.title = t('meta.title');
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', t('meta.description'));

  root.querySelectorAll?.('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    const translated = t(key);
    const attrs = element.dataset.i18nAttr;
    if (attrs) {
      attrs.split(',').map(value => value.trim()).filter(Boolean).forEach(attr => element.setAttribute(attr, translated));
      return;
    }
    if (element.children.length) replaceDirectText(element, translated);
    else element.textContent = translated;
  });

  root.querySelectorAll?.('[data-i18n-html]').forEach(element => {
    element.innerHTML = t(element.dataset.i18nHtml);
  });

  root.querySelectorAll?.('[data-i18n-placeholder]').forEach(element => {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  });
}

export function setLanguage(language) {
  if (!supported.includes(language) || language === currentLanguage) return;
  currentLanguage = language;
  try { localStorage.setItem(STORAGE_KEY, language); } catch {}
  translatePage();
  window.dispatchEvent(new CustomEvent('languagechange', { detail: { language } }));
}

export function initI18n() {
  const select = document.getElementById('language-select');
  if (select) select.value = currentLanguage;
  translatePage();
}


export function localizeGeneratedRegionName(name) {
  const value = String(name ?? '');
  if (currentLanguage !== 'en') return value;
  let match = value.match(/^Região (.+)$/);
  return match ? `Region ${match[1]}` : value;
}

export function translateRuntimeMessage(message) {
  const text = String(message ?? '');
  if (currentLanguage === 'pt-BR') return text;
  if (text === ptBR.errors.geojsonFeatureCollection) return t('errors.geojsonFeatureCollection');
  if (text === ptBR.errors.geojsonNoPolygons) return t('errors.geojsonNoPolygons');
  if (text === ptBR.errors.noRegions) return t('errors.noRegions');
  const conservation = text.match(/^Violação de conservação na região (.+)\.$/);
  if (conservation) return t('errors.conservation', { region: conservation[1] });
  return text;
}
