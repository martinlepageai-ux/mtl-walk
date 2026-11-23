(() => {
  const $ = (selector) => document.querySelector(selector);
  const loginPanel = $('#login-panel');
  const dashboard = $('#dashboard');
  const csrf = { value: '' };
  const messages = {
    login: $('#login-message'),
    posts: $('#post-message'),
    lessons: $('#lesson-message'),
    calendars: $('#calendar-message')
  };

  async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = Object.assign({ 'Accept': 'application/json' }, options.headers || {});
    if (options.body) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrf.value) headers['X-CSRF-Token'] = csrf.value;
    const response = await fetch(path, {
      method,
      headers,
      body: options.body,
      credentials: 'same-origin'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'La demande n’a pas abouti.');
    return result;
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function setMessage(target, message, isError = false) {
    target.textContent = message || '';
    target.style.color = isError ? 'var(--red)' : 'var(--muted)';
  }

  function showDashboard(username) {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    $('#logout').hidden = false;
    $('#welcome').textContent = 'Connecté comme ' + username + '.';
    loadPosts();
    loadLessons();
    loadCalendars();
  }

  function showLogin(message = '') {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    $('#logout').hidden = true;
    setMessage(messages.login, message, Boolean(message));
  }

  async function loadPosts() {
    try {
      const result = await api('/api/admin/posts');
      renderPosts(result.posts);
    } catch (error) { setMessage(messages.posts, error.message, true); }
  }

  function renderPosts(posts) {
    const list = $('#posts-list');
    list.replaceChildren();
    if (!posts.length) {
      list.append(node('p', 'empty', 'Aucune publication pour le moment. Écris une note ou garde-la en brouillon.'));
      return;
    }
    posts.forEach((post) => {
      const item = node('article', 'item');
      const title = node('h3', '', post.title);
      const meta = node('div', 'item-meta', post.language.toUpperCase() + ' · ' + (post.status === 'published' ? 'Publié' : 'Brouillon'));
      const summary = node('p', '', post.summary || 'Aucun résumé.');
      const actions = node('div', 'item-actions');
      const edit = node('button', 'button secondary', 'Modifier');
      edit.type = 'button';
      edit.addEventListener('click', () => editPost(post));
      actions.append(edit);
      if (post.status === 'published') {
        const view = node('a', 'button secondary', 'Voir');
        view.href = 'post.html?slug=' + encodeURIComponent(post.slug) + '&lang=' + encodeURIComponent(post.language);
        actions.append(view);
      }
      const remove = node('button', 'button danger', 'Supprimer');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!window.confirm('Supprimer cette publication?')) return;
        try { await api('/api/admin/posts/' + post.id, { method: 'DELETE' }); await loadPosts(); }
        catch (error) { setMessage(messages.posts, error.message, true); }
      });
      actions.append(remove);
      item.append(meta, title, summary, actions);
      list.append(item);
    });
  }

  function editPost(post) {
    $('#post-id').value = post.id;
    $('#post-title').value = post.title;
    $('#post-language').value = post.language;
    $('#post-summary').value = post.summary || '';
    $('#post-body').value = post.body;
    $('#post-status').value = post.status;
    $('#post-slug').value = post.slug;
    $('#post-form-title').textContent = 'Modifier la note';
    $('#post-title').focus();
  }

  function clearPostForm() {
    $('#post-form').reset();
    $('#post-id').value = '';
    $('#post-language').value = 'es';
    $('#post-status').value = 'draft';
    $('#post-form-title').textContent = 'Nouvelle note';
    setMessage(messages.posts, '');
  }

  $('#new-post').addEventListener('click', clearPostForm);

  $('#post-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = form.get('id');
    const payload = {
      title: form.get('title'),
      language: form.get('language'),
      summary: form.get('summary'),
      body: form.get('body'),
      status: form.get('status'),
      slug: form.get('slug')
    };
    try {
      const result = await api(id ? '/api/admin/posts/' + id : '/api/admin/posts', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      clearPostForm();
      await loadPosts();
      setMessage(messages.posts, result.status === 'published' ? 'Publication enregistrée.' : 'Brouillon enregistré.');
    } catch (error) { setMessage(messages.posts, error.message, true); }
  });

  async function loadLessons() {
    try {
      const result = await api('/api/admin/lessons');
      renderLessons(result.lessons);
    } catch (error) { setMessage(messages.lessons, error.message, true); }
  }

  function renderLessons(lessons) {
    const list = $('#lessons-list');
    list.replaceChildren();
    if (!lessons.length) {
      list.append(node('p', 'empty', 'Aucune leçon enregistrée. Ajoute une situation après une visite pour garder une action concrète en mémoire.'));
      return;
    }
    lessons.forEach((lesson) => {
      const item = node('article', 'item');
      const metaText = [lesson.tour_date, lesson.tour_name, lesson.category].filter(Boolean).join(' · ');
      item.append(node('div', 'item-meta', metaText || 'Note de tournée'));
      item.append(node('h3', '', lesson.situation));
      item.append(node('p', '', 'À retenir : ' + lesson.learning));
      if (lesson.next_action) item.append(node('p', '', 'Prochaine fois : ' + lesson.next_action));
      if (lesson.tags) item.append(node('div', 'item-meta', 'Mots-clés · ' + lesson.tags));
      const status = node('span', 'status', lesson.status === 'open' ? 'À garder en tête' : 'Résolu');
      item.append(status);
      const actions = node('div', 'item-actions');
      const toggle = node('button', 'button secondary', lesson.status === 'open' ? 'Marquer résolu' : 'Réouvrir');
      toggle.type = 'button';
      toggle.addEventListener('click', async () => {
        const nextStatus = lesson.status === 'open' ? 'resolved' : 'open';
        try {
          await api('/api/admin/lessons/' + lesson.id, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus })
          });
          await loadLessons();
        } catch (error) { setMessage(messages.lessons, error.message, true); }
      });
      actions.append(toggle);
      item.append(actions);
      list.append(item);
    });
  }

  $('#lesson-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      await api('/api/admin/lessons', { method: 'POST', body: JSON.stringify(payload) });
      event.currentTarget.reset();
      setMessage(messages.lessons, 'Leçon ajoutée au carnet.');
      await loadLessons();
    } catch (error) { setMessage(messages.lessons, error.message, true); }
  });

  async function loadCalendars() {
    try {
      const result = await api('/api/admin/calendars');
      const list = $('#calendar-list');
      list.replaceChildren();
      if (!result.connections.length) {
        list.append(node('p', 'empty', result.message || 'Aucun calendrier relié.'));
      }
      $('#sync-calendars').disabled = !result.providers || result.providers.length === 0;
      result.connections.forEach((connection) => {
        const row = node('div', 'provider-row');
        const copy = node('div');
        copy.append(node('h3', '', connection.account_label || connection.provider));
        copy.append(node('p', '', connection.status + (connection.last_synced_at ? ' · dernière mise à jour ' + connection.last_synced_at : '')));
        row.append(copy);
        list.append(row);
      });
      await loadCalendarEvents();
    } catch (error) { setMessage(messages.calendars, error.message, true); }
  }

  async function loadCalendarEvents() {
    try {
      const result = await api('/api/admin/calendar/events');
      const root = $('#calendar-results');
      root.replaceChildren();
      if (result.conflicts.length) {
        const warning = node('article', 'item');
        warning.append(node('h3', '', 'Chevauchements à vérifier'));
        result.conflicts.forEach((conflict) => warning.append(node('p', '', conflict.first.title + ' / ' + conflict.second.title)));
        root.append(warning);
      }
      if (!result.events.length) {
        root.append(node('p', 'empty', 'Les événements réunis apparaîtront ici après connexion des calendriers.'));
        return;
      }
      result.events.forEach((event) => {
        const item = node('article', 'item');
        item.append(node('div', 'item-meta', event.starts_at + ' · ' + (event.sources || []).join(', ')));
        item.append(node('h3', '', event.title));
        if (event.location) item.append(node('p', '', event.location));
        root.append(item);
      });
    } catch (error) { setMessage(messages.calendars, error.message, true); }
  }

  $('#sync-calendars').addEventListener('click', async () => {
    $('#sync-calendars').disabled = true;
    try { await api('/api/admin/calendars/sync', { method: 'POST', body: JSON.stringify({}) }); await loadCalendars(); }
    catch (error) { setMessage(messages.calendars, error.message, true); $('#sync-calendars').disabled = false; }
  });

  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      $('#posts-panel').hidden = tab.dataset.tab !== 'posts';
      $('#lessons-panel').hidden = tab.dataset.tab !== 'lessons';
      $('#calendars-panel').hidden = tab.dataset.tab !== 'calendars';
    });
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(messages.login, '');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
      });
      csrf.value = result.csrfToken;
      event.currentTarget.reset();
      showDashboard(result.username);
    } catch (error) { setMessage(messages.login, error.message, true); }
  });

  $('#logout').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST', body: JSON.stringify({}) }); } catch (_) {}
    csrf.value = '';
    showLogin('Tu es déconnecté.');
  });

  api('/api/me').then((result) => {
    csrf.value = result.csrfToken;
    showDashboard(result.username);
  }).catch(() => showLogin());
})();
