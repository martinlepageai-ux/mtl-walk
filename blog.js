(() => {
  const buttons = document.querySelectorAll('[data-lang]');
  let currentLanguage = 'fr';
  function applyLanguage(lang) {
    currentLanguage = lang;
    document.documentElement.lang = lang;
    document.querySelector('.site-nav').setAttribute('aria-label', lang === 'fr' ? 'Navigation principale' : lang === 'en' ? 'Main navigation' : 'Navegación principal');
    try { const url = new URL(window.location.href); url.searchParams.set('lang', lang); window.history.replaceState(null, '', url); } catch (_) {}
    document.querySelectorAll('[data-copy-es]').forEach((element) => {
      const value = element.getAttribute('data-copy-' + lang);
      if (value !== null) element.textContent = value;
    });
    document.querySelectorAll('[data-alt-es]').forEach((image) => {
      const value = image.getAttribute('data-alt-' + lang);
      if (value !== null) image.alt = value;
    });
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.lang === lang)));
    document.querySelector('.language-switch').setAttribute('aria-label', lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'Idioma');
    document.querySelectorAll('[data-home-anchor]').forEach((link) => {
      link.href = 'index.html?lang=' + lang + '#' + link.dataset.homeAnchor;
    });
    document.querySelectorAll('[data-home]').forEach((link) => { link.href = 'index.html?lang=' + lang; });
    renderPosts(window.blogPosts || []);
    document.title = lang === 'fr' ? 'Notes de marche · Montréal à double entente' : lang === 'en' ? 'Field notes · Montréal à double entente' : 'Notas de caminata · Montréal à double entente';
    const descriptions = {
      es:'Montréal à double entente. Notas de Bernardo sobre Montréal, sus calles y sus recorridos guiados.',
      fr:'Montréal à double entente. Les notes de Bernardo sur Montréal, ses rues et ses visites guidées.',
      en:'Montréal à double entente. Bernardo’s notes on Montréal, its streets and guided walks.'
    };
    document.querySelector('meta[name="description"]').content = descriptions[lang];
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function renderPosts(posts) {
    const feed = document.querySelector('#feed');
    if (!feed) return;
    feed.replaceChildren();
    const matching = posts.filter((post) => post.language === currentLanguage);
    const visible = matching.length ? matching : posts;
    if (!visible.length) {
      const messages = {
        es:'Las nuevas notas aparecerán aquí.',
        fr:'Les nouvelles notes apparaîtront ici.',
        en:'New field notes will appear here.'
      };
      feed.append(node('p', 'empty', messages[currentLanguage]));
      return;
    }
    visible.forEach((post) => {
      const article = node('article', 'post');
      const dateText = (post.published_at || post.created_at || '').slice(0, 10);
      article.append(node('div', 'date', dateText + ' · ' + post.language.toUpperCase()));
      const details = node('div');
      details.append(node('h2', '', post.title));
      if (post.summary) details.append(node('p', '', post.summary));
      const read = node('a', 'read', currentLanguage === 'fr' ? 'Lire la note →' : currentLanguage === 'en' ? 'Read the note →' : 'Leer la nota →');
      read.href = 'post.html?slug=' + encodeURIComponent(post.slug) + '&lang=' + currentLanguage;
      details.append(read);
      article.append(details);
      feed.append(article);
    });
  }

  window.blogPosts = [];
  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.lang)));
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (['fr','en','es'].includes(requested)) currentLanguage = requested;
  applyLanguage(currentLanguage);

  fetch('/api/posts', { headers: { 'Accept':'application/json' } })
    .then((response) => { if (!response.ok) throw new Error('Could not load posts.'); return response.json(); })
    .then((data) => { window.blogPosts = data.posts || []; renderPosts(window.blogPosts); })
    .catch(() => {
      const messages = {
        es:'Las notas nuevas aparecerán aquí cuando el sitio esté conectado.',
        fr:'Les nouvelles notes apparaîtront ici une fois le site connecté.',
        en:'New field notes will appear here when the site is connected.'
      };
      const feed = document.querySelector('#feed');
      feed.replaceChildren(node('p', 'empty', messages[currentLanguage]));
    });
})();
