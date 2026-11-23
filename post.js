(() => {
  const buttons = document.querySelectorAll('[data-lang]');
  const query = new URLSearchParams(window.location.search);
  const slug = query.get('slug') || '';
  let currentLanguage = query.get('lang') || 'fr';
  let currentPost = null;

  function applyLanguage(lang) {
    if (!['fr','en','es'].includes(lang)) lang = 'fr';
    currentLanguage = lang;
    document.documentElement.lang = lang;
    document.querySelector('.site-nav').setAttribute('aria-label', lang === 'fr' ? 'Navigation principale' : lang === 'en' ? 'Main navigation' : 'Navegación principal');
    try { const url = new URL(window.location.href); url.searchParams.set('lang', lang); window.history.replaceState(null, '', url); } catch (_) {}
    document.querySelectorAll('[data-copy-es]').forEach((element) => {
      const value = element.getAttribute('data-copy-' + lang);
      if (value !== null) element.textContent = value;
    });
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.lang === lang)));
    document.querySelector('.language-switch').setAttribute('aria-label', lang === 'fr' ? 'Langue' : lang === 'en' ? 'Language' : 'Idioma');
    document.querySelectorAll('[data-home-anchor]').forEach((link) => {
      link.href = 'index.html?lang=' + lang + '#' + link.dataset.homeAnchor;
    });
    document.querySelectorAll('[data-home]').forEach((link) => { link.href = 'index.html?lang=' + lang + '#home'; });
    const blog = document.querySelector('#back-blog');
    blog.href = 'blog.html?lang=' + lang;
    document.querySelectorAll('[data-blog-link]').forEach((link) => { link.href = 'blog.html?lang=' + lang; });
    if (currentPost) renderPost(currentPost);
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function languageLabel(sourceLanguage, interfaceLanguage) {
    if (interfaceLanguage === 'fr') return sourceLanguage === 'en' ? 'Cette note est en anglais.' : 'Cette note est en espagnol.';
    if (interfaceLanguage === 'en') return sourceLanguage === 'fr' ? 'This note is in French.' : 'This note is in Spanish.';
    return sourceLanguage === 'fr' ? 'Esta nota está en francés.' : 'Esta nota está en inglés.';
  }

  function renderPost(post) {
    const root = document.querySelector('#post-content');
    root.replaceChildren();
    const note = document.querySelector('#language-note');
    if (post.language !== currentLanguage) {
      note.hidden = false;
      note.textContent = languageLabel(post.language, currentLanguage);
    } else {
      note.hidden = true;
    }
    const date = node('div', 'label', (post.published_at || '').slice(0, 10));
    const title = node('h1', '', post.title);
    const summary = node('p', 'summary', post.summary || '');
    const body = node('div', 'body', '');
    (post.body || '').split(/\n{2,}/).filter(Boolean).forEach((paragraph) => body.append(node('p', '', paragraph)));
    root.append(date, title, summary, body);
    document.title = post.title + ' · Montréal à double entente';
    document.querySelector('meta[name="description"]').content = post.summary || post.title;
  }

  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.lang)));
  applyLanguage(currentLanguage);

  if (!slug) {
    const root = document.querySelector('#post-content');
    const messages = { fr:'Note introuvable.', en:'Note not found.', es:'Nota no encontrada.' };
    root.replaceChildren(node('h1', '', messages[currentLanguage] || messages.es));
    return;
  }
  fetch('/api/posts/' + encodeURIComponent(slug), { headers: { 'Accept':'application/json' } })
    .then((response) => { if (!response.ok) throw new Error('Not found.'); return response.json(); })
    .then((data) => { currentPost = data.post; renderPost(currentPost); })
    .catch(() => {
      const root = document.querySelector('#post-content');
      root.replaceChildren(node('h1', '', currentLanguage === 'fr' ? 'Note introuvable.' : currentLanguage === 'en' ? 'Note not found.' : 'Nota no encontrada.'));
    });
})();
