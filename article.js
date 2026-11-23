(() => {
  const buttons = document.querySelectorAll('[data-lang]');
  const translations = document.querySelectorAll('[data-copy-es]');
  const descriptions = {
    es:'Una nota breve de Bernardo sobre Place d’Armes y la manera de mirar Montréal a pie.',
    fr:'Une courte note de Bernardo sur Place d’Armes et sa façon de découvrir Montréal à pied.',
    en:'A brief note from Bernardo on Place d’Armes and how to discover Montréal on foot.'
  };
  function applyLanguage(lang) {
    const button = document.querySelector('[data-lang="' + lang + '"]');
    if (!button) return;
    translations.forEach((element) => {
      const value = element.getAttribute('data-copy-' + lang);
      if (value !== null) element.textContent = value;
    });
    document.querySelectorAll('[data-alt-es]').forEach((image) => {
      const value = image.getAttribute('data-alt-' + lang);
      if (value !== null) image.alt = value;
    });
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    document.documentElement.lang = lang;
    document.querySelector('.nav').setAttribute('aria-label', lang === 'fr' ? 'Navigation principale' : lang === 'en' ? 'Main navigation' : 'Navegación principal');
    try { const url = new URL(window.location.href); url.searchParams.set('lang', lang); window.history.replaceState(null, '', url); } catch (_) {}
    document.querySelector('.language-switch').setAttribute('aria-label', lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'Idioma');
    document.querySelector('meta[name="description"]').content = descriptions[lang];
    document.title = lang === 'fr' ? 'Place d’Armes · Une note de marche — Montréal à double entente' : lang === 'en' ? 'Place d’Armes · A field note — Montréal à double entente' : 'Place d’Armes · Una nota de caminata — Montréal à double entente';
    document.querySelectorAll('[data-home-anchor]').forEach((link) => {
      const anchor = link.dataset.homeAnchor;
      link.href = 'index.html?lang=' + lang + (anchor ? '#' + anchor : '');
    });
  }
  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.lang)));
  const requested = new URLSearchParams(window.location.search).get('lang');
  applyLanguage(['fr','en','es'].includes(requested) ? requested : 'fr');
})();
