(() => {
  const buttons = [...document.querySelectorAll('[data-lang]')];
  const copy = [...document.querySelectorAll('[data-copy-es]')];

  const labels = {
    es: {
      nav: 'Navegación principal', language: 'Idioma', title: 'Las solitudes de Montréal · Montréal à double entente',
      description: 'Tres ejemplos de las solitudes de Montréal: lugares donde historias, instituciones y reglas se cruzan sin siempre encontrarse.'
    },
    fr: {
      nav: 'Navigation principale', language: 'Langue', title: 'Les solitudes de Montréal · Montréal à double entente',
      description: 'Trois exemples des solitudes de Montréal : des lieux où des histoires, des institutions et des règles se croisent sans toujours se rejoindre.'
    },
    en: {
      nav: 'Main navigation', language: 'Language', title: 'Montréal’s solitudes · Montréal à double entente',
      description: 'Three examples of Montréal’s solitudes: places where histories, institutions and rules cross without always meeting.'
    }
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
