/**
 * DocCenter i18n engine — vanilla JS, zero dependency.
 *
 * Public API:
 *   window.i18n.t(key, vars?)       → resolve translation, fallback chain: current → en → key
 *   window.i18n.setLang(lang)       → switch language, persist to localStorage, dispatch 'langchange'
 *   window.i18n.getLang()           → current language code ('en' | 'zh')
 *   window.i18n.applyDOM(root?)     → re-apply translations to data-i18n* nodes (default: document)
 *
 * HTML markup:
 *   <span data-i18n="key">fallback text</span>
 *   <button data-i18n-title="key">icon</button>
 *   <input data-i18n-placeholder="key" />
 *   <div data-i18n-html="key">fallback HTML</div>
 *
 * Default language: 'en' (first-visit experience aligned with GitHub global audience).
 * User's choice is remembered via localStorage and applied on subsequent visits.
 *
 * Fallback chain: dicts[currentLang][key] → dicts['en'][key] → key (literal string).
 * Missing keys are NOT throwing; they degrade gracefully to the key itself.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'doccenter.lang';
  const SUPPORTED = ['en', 'zh'];
  const DEFAULT = 'en';

  function getLangPref() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (_) {
      // localStorage may be blocked in private mode; fall back to default
    }
    return DEFAULT;
  }

  let currentLang = getLangPref();

  function getDict(lang) {
    if (lang === 'en') return window.LOCALE_EN || {};
    if (lang === 'zh') return window.LOCALE_ZH || {};
    return {};
  }

  function t(key, vars) {
    const cur = getDict(currentLang);
    const fb = getDict(DEFAULT);
    let s = (cur && cur[key]) || (fb && fb[key]) || key;
    if (vars && typeof s === 'string') {
      for (const k of Object.keys(vars)) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      }
    }
    return s;
  }

  function applyDOM(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.dataset.i18nTitle);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    if (lang === currentLang) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    document.documentElement.lang = lang;
    applyDOM();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  // Expose
  window.i18n = {
    t: t,
    setLang: setLang,
    getLang: function () { return currentLang; },
    applyDOM: applyDOM,
    SUPPORTED: SUPPORTED.slice(),
    DEFAULT: DEFAULT
  };

  // Set <html lang="..."> early so screen readers and CSS :lang() rules work
  document.documentElement.lang = currentLang;

  // Apply translations as soon as DOM is parsed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { applyDOM(); });
  } else {
    applyDOM();
  }
})();
