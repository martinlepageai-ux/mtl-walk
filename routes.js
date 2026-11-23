(() => {
  const buttons = [...document.querySelectorAll('[data-lang]')];
  const copy = [...document.querySelectorAll('[data-copy-es]')];
  const labels = {
    es: { nav: 'Navegación principal', language: 'Idioma', title: 'Pistas de parcours · Montréal à double entente', description: 'Pistas de parcours de Montréal à double entente: Secrets de l’Est y Lanes from the West.' },
    fr: { nav: 'Navigation principale', language: 'Langue', title: 'Pistes de parcours · Montréal à double entente', description: 'Pistes de parcours de Montréal à double entente : Secrets de l’Est et Lanes from the West.' },
    en: { nav: 'Main navigation', language: 'Language', title: 'Route ideas · Montréal à double entente', description: 'Route ideas from Montréal à double entente: Secrets de l’Est and Lanes from the West.' }
  };
  function applyLanguage(lang) {
    if (!labels[lang]) lang = 'fr';
    copy.forEach((element) => {
      const value = element.getAttribute('data-copy-' + lang);
      if (value !== null) element.textContent = value;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    document.documentElement.lang = lang;
    document.querySelector('.site-nav').setAttribute('aria-label', labels[lang].nav);
    document.querySelector('.language-switch').setAttribute('aria-label', labels[lang].language);
    document.querySelector('meta[name="description"]').content = labels[lang].description;
    document.title = labels[lang].title;
    document.querySelectorAll('[data-home-anchor]').forEach((link) => {
      const anchor = link.dataset.homeAnchor;
      link.href = 'index.html?lang=' + lang + (anchor ? '#' + anchor : '');
    });
    document.querySelectorAll('[data-home]').forEach((link) => { link.href = 'index.html?lang=' + lang + '#home'; });
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url);
    } catch (_) {}
  }
  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.lang)));
  const requested = new URLSearchParams(window.location.search).get('lang');
  applyLanguage(['fr', 'en', 'es'].includes(requested) ? requested : 'fr');
})();
