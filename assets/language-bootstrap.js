(() => {
  const supportedLanguages = new Set([
    'am', 'ar', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr',
    'he', 'hi', 'hu', 'it', 'ja', 'ko', 'ku', 'nl', 'no', 'pl', 'pt', 'ro',
    'ru', 'so', 'sv', 'th', 'ti', 'tr', 'uk', 'ur', 'vi', 'zh',
  ]);
  const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);

  try {
    const savedLanguage = localStorage.getItem('dealettLanguage');
    const language = supportedLanguages.has(savedLanguage) ? savedLanguage : 'sv';
    document.documentElement.lang = language;
    document.documentElement.dir = rtlLanguages.has(language) ? 'rtl' : 'ltr';
  } catch {
    document.documentElement.lang = 'sv';
    document.documentElement.dir = 'ltr';
  }
})();
