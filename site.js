(() => {
  const page = document.body;
  page.classList.add('js-ready');
  const buttons = [...document.querySelectorAll('[data-lang]')];
  const copy = [...document.querySelectorAll('[data-copy-es]')];
  const imageAlts = [...document.querySelectorAll('[data-alt-es]')];
  const navLinks = [...document.querySelectorAll('[data-section-link]')];
  const menuToggle = document.querySelector('.menu-toggle');
  const siteNav = document.querySelector('#primary-nav');
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const requestDialog = document.querySelector('#request-dialog');
  const tourDialog = document.querySelector('#tour-dialog');
  const requestForm = document.querySelector('#request-form');
  const requestSuccess = document.querySelector('#request-success');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const audienceItems = [...document.querySelectorAll('[data-audience]')];
  const filterStatus = document.querySelector('#filter-status');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let currentLanguage = 'fr';
  let activeFilter = 'all';
  let currentTour = 'old-montreal';
  let scrollFrame = null;

  const languageLabels = {
    es: {
      nav: 'Navegación principal', language: 'Idioma', title: 'Montréal à double entente — Con Bernardo',
      description: 'Montréal à double entente. Visitas guiadas en Montréal, normalmente en francés o inglés y a veces en español. Tours colectivos, privados y formatos adaptados a cada grupo.'
    },
    fr: {
      nav: 'Navigation principale', language: 'Langue', title: 'Montréal à double entente — Avec Bernardo',
      description: 'Montréal à double entente. Visites guidées à Montréal, le plus souvent en français ou en anglais, parfois en espagnol. Tours collectifs, privés et formats adaptés à chaque groupe.'
    },
    en: {
      nav: 'Main navigation', language: 'Language', title: 'Montréal à double entente — With Bernardo',
      description: 'Montréal à double entente. Guided walks in Montréal, most often in French or English and sometimes in Spanish. Collective, private and audience-adapted formats.'
    }
  };

  const filterMessages = {
    es: { all: 'Mostrando todas las opciones.', travellers: 'Mostrando opciones para viajeros.', families: 'Mostrando opciones para familias.', schools: 'Mostrando opciones para escuelas.', accessibility: 'Mostrando la ruta de accesibilidad.', groups: 'Mostrando opciones para grupos.' },
    fr: { all: 'Toutes les options sont affichées.', travellers: 'Options pour les voyageurs affichées.', families: 'Options pour les familles affichées.', schools: 'Options pour les écoles affichées.', accessibility: 'Le parcours accessible est affiché.', groups: 'Options pour les groupes affichées.' },
    en: { all: 'Showing every option.', travellers: 'Showing options for travellers.', families: 'Showing options for families.', schools: 'Showing options for schools.', accessibility: 'Showing the accessibility route.', groups: 'Showing options for groups.' }
  };

  const tourData = {
    'old-montreal': {
      fr: { title: 'Vieux-Montréal', summary: 'Places, rues et lieux où la ville a pris forme.', duration: '2 heures', pace: 'Marche tranquille', language: 'Français · English' },
      en: { title: 'Old Montréal', summary: 'Squares, streets and places where the city began.', duration: '2 hours', pace: 'Easy walking pace', language: 'Français · English' },
      es: { title: 'Vieux-Montréal', summary: 'Plazas, calles y lugares donde empezó la ciudad.', duration: '2 horas', pace: 'Caminata tranquila', language: 'Français · English · Español según la fecha' }
    },
    'port-downtown': {
      fr: { title: 'Du port au centre', summary: 'Vieux-Montréal, ville souterraine et centre-ville reliés par une même question : qui décide de la ville ?', duration: '3 heures', pace: 'Marche + métro ou REM', language: 'Français · English' },
      en: { title: 'From port to downtown', summary: 'Old Montréal, the underground city and downtown connected by one question: who gets to decide the city?', duration: '3 hours', pace: 'Walking + métro or REM', language: 'Français · English' },
      es: { title: 'Del puerto al centro', summary: 'Vieux-Montréal, ciudad subterránea y centro unidos por una pregunta: ¿quién decide la ciudad?', duration: '3 horas', pace: 'Caminata + metro o REM', language: 'Français · English · Español según la fecha' }
    },
    'city-neighbourhoods': {
      fr: { title: 'La ville et ses quartiers', summary: 'Un parcours plus long pour relier le centre à un quartier résidentiel, au rythme du groupe.', duration: '4 heures', pace: 'Marche + métro ou REM', language: 'Français · English' },
      en: { title: 'City and neighbourhoods', summary: 'A longer route connecting downtown to a residential neighbourhood at the group’s pace.', duration: '4 hours', pace: 'Walking + métro or REM', language: 'Français · English' },
      es: { title: 'Ciudad y barrios', summary: 'Un recorrido más largo para conectar el centro con un barrio residencial, al ritmo del grupo.', duration: '4 horas', pace: 'Caminata + metro o REM', language: 'Français · English · Español según la fecha' }
    }
  };

  function setAriaLabels(lang) {
    document.querySelectorAll('[data-aria-' + lang + ']').forEach((element) => {
      element.setAttribute('aria-label', element.getAttribute('data-aria-' + lang));
    });
  }

  function setPlaceholders(lang) {
    document.querySelectorAll('[data-placeholder-' + lang + ']').forEach((element) => {
      element.placeholder = element.getAttribute('data-placeholder-' + lang);
    });
  }

  function renderTourDialog() {
    const data = tourData[currentTour]?.[currentLanguage] || tourData['old-montreal'][currentLanguage];
    if (!data) return;
    const title = document.querySelector('#tour-dialog-title');
    const summary = document.querySelector('#tour-dialog-summary');
    const duration = document.querySelector('#tour-dialog-duration');
    const pace = document.querySelector('#tour-dialog-pace');
    const language = document.querySelector('#tour-dialog-language');
    if (title) title.textContent = data.title;
    if (summary) summary.textContent = data.summary;
    if (duration) duration.textContent = data.duration;
    if (pace) pace.textContent = data.pace;
    if (language) language.textContent = data.language;
  }

  function applyLanguage(lang) {
    const activeButton = document.querySelector('[data-lang="' + lang + '"]');
    if (!activeButton) return;
    currentLanguage = lang;
    copy.forEach((element) => {
      const value = element.getAttribute('data-copy-' + lang);
      if (value !== null) element.textContent = value;
    });
    imageAlts.forEach((image) => {
      const value = image.getAttribute('data-alt-' + lang);
      if (value !== null) image.alt = value;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button === activeButton)));
    document.documentElement.lang = lang;

    const labels = languageLabels[lang];
    document.querySelector('.site-nav')?.setAttribute('aria-label', labels.nav);
    document.querySelector('.language-switch')?.setAttribute('aria-label', labels.language);
    document.querySelector('meta[name="description"]')?.setAttribute('content', labels.description);
    document.title = labels.title;
    document.querySelectorAll('[data-blog-link]').forEach((link) => { link.href = 'blog.html?lang=' + lang; });
    document.querySelectorAll('[data-solitudes-link]').forEach((link) => { link.href = 'solitudes.html?lang=' + lang; });
    document.querySelectorAll('[data-routes-link]').forEach((link) => { link.href = 'routes.html?lang=' + lang; });
    setAriaLabels(lang);
    setPlaceholders(lang);
    renderTourDialog();
    updateFilter(activeFilter, false);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url);
    } catch (_) {}
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (tourDialog && dialog === requestDialog && tourDialog.open) closeDialog(tourDialog);
    if (dialog.open) return;
    if (dialog.showModal) dialog.showModal();
    else {
      dialog.setAttribute('open', '');
      dialog.classList.add('is-open');
    }
    dialog.classList.remove('is-success');
    if (dialog === requestDialog && requestForm && requestForm.hidden) {
      requestForm.hidden = false;
      if (requestSuccess) requestSuccess.hidden = true;
    }
    window.setTimeout(() => dialog.querySelector('input,select,textarea,button')?.focus(), 50);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.close) dialog.close();
    else {
      dialog.removeAttribute('open');
      dialog.classList.remove('is-open');
    }
  }

  function updateFilter(filter, animate = true) {
    activeFilter = filter;
    filterButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    let count = 0;
    audienceItems.forEach((item) => {
      const visible = filter === 'all' || item.dataset.audience.split(/\s+/).includes(filter);
      item.hidden = !visible;
      if (visible) {
        count += 1;
        if (animate && !reducedMotion) {
          item.classList.remove('filter-in');
          void item.offsetWidth;
          item.classList.add('filter-in');
        }
      }
    });
    if (filterStatus) {
      const base = filterMessages[currentLanguage]?.[filter] || filterMessages.fr.all;
      const suffix = currentLanguage === 'fr' ? (count === 1 ? ' format.' : ' formats.') : currentLanguage === 'es' ? (count === 1 ? ' formato.' : ' formatos.') : (count === 1 ? ' format.' : ' formats.');
      filterStatus.textContent = base + ' ' + count + suffix;
    }
  }

  function setupMenu() {
    if (!menuToggle || !siteNav) return;
    const setOpen = (open) => {
      menuToggle.setAttribute('aria-expanded', String(open));
      siteNav.classList.toggle('is-open', open);
      page.classList.toggle('menu-open', open);
    };
    menuToggle.addEventListener('click', () => setOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
    navLinks.forEach((link) => link.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function setupDialogs() {
    document.querySelectorAll('[data-open-request]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        openDialog(requestDialog);
      });
    });
    document.querySelectorAll('[data-tour-detail]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        currentTour = trigger.dataset.tourDetail || 'old-montreal';
        renderTourDialog();
        openDialog(tourDialog);
      });
    });
    document.querySelectorAll('[data-close-dialog]').forEach((trigger) => {
      trigger.addEventListener('click', () => closeDialog(trigger.closest('dialog')));
    });
    [requestDialog, tourDialog].forEach((dialog) => {
      if (!dialog) return;
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
    requestForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(requestForm);
      const payload = Object.fromEntries(formData.entries());
      payload.languagePage = currentLanguage;
      payload.savedAt = new Date().toISOString();
      try { window.localStorage.setItem('bernardo.prototype.request', JSON.stringify(payload)); } catch (_) {}
      requestForm.hidden = true;
      if (requestSuccess) requestSuccess.hidden = false;
      requestDialog?.classList.add('is-success');
    });
  }

  function setupScrollMotion() {
    const update = () => {
      scrollFrame = null;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
      document.documentElement.style.setProperty('--scroll-progress', progress + '%');
      header?.classList.toggle('is-scrolled', window.scrollY > 12);
      if (hero && !reducedMotion) hero.style.setProperty('--hero-shift', Math.min(window.scrollY * 0.08, 24) + 'px');
    };
    const requestUpdate = () => {
      if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    update();
  }

  function setupReveal() {
    const elements = [...document.querySelectorAll('.about-photo,.tour-card,.offer-card,.private-point,.social-panel,.faq-list details')];
    if (!elements.length || !('IntersectionObserver' in window) || reducedMotion) return;
    const observer = new IntersectionObserver((entries, instance) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
        const element = entry.target;
        if (element.dataset.motionDone) return;
        element.dataset.motionDone = 'true';
        if (typeof element.animate !== 'function') {
          instance.unobserve(element);
          return;
        }
        element.animate([
          { opacity: 0, transform: 'translateY(16px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 430, delay: index * 35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
        instance.unobserve(element);
      });
    }, { rootMargin: '0px 0px -9% 0px', threshold: .08 });
    elements.forEach((element) => observer.observe(element));
  }

  function setupPressFeedback() {
    document.querySelectorAll('.button,.language,.menu-toggle,.filter-button').forEach((control) => {
      const clear = () => control.classList.remove('is-pressed');
      control.addEventListener('pointerdown', () => control.classList.add('is-pressed'));
      control.addEventListener('pointerup', clear);
      control.addEventListener('pointercancel', clear);
      control.addEventListener('pointerleave', clear);
    });
  }

  buttons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.lang)));
  navLinks.forEach((link) => link.addEventListener('click', () => {
    navLinks.forEach((item) => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'page');
  }));
  filterButtons.forEach((button) => button.addEventListener('click', () => updateFilter(button.dataset.filter)));

  if ('IntersectionObserver' in window && navLinks.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        if (link.hash === '#' + visible.target.id) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-28% 0px -62% 0px', threshold: [0, .15, .4] });
    document.querySelectorAll('main section[id]').forEach((section) => observer.observe(section));
  }

  setupMenu();
  setupDialogs();
  setupScrollMotion();
  setupReveal();
  setupPressFeedback();

  const requested = new URLSearchParams(window.location.search).get('lang');
  applyLanguage(['fr', 'en', 'es'].includes(requested) ? requested : 'fr');
})();
