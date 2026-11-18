/* ==========================================================
   Cartoon Dreamland - main script (shared by all pages)
   Sections:
   1. Helpers & storage          7. Contact + newsletter forms
   2. Theme (light / dark)       8. Cartoon library (search/filter)
   3. Navigation & UI effects    9. Characters (external API)
   4. Validators                 10. Gallery, FAQ, quiz
   5. Authentication simulation  11. Page initialisation
   6. Profile page
   ========================================================== */
'use strict';

/* ---------- 1. Helpers & storage ---------- */
const KEYS = {
  theme: 'cd_theme',
  users: 'cd_users',
  session: 'cd_session',
  favorites: 'cd_favorites',
  cartoonSearch: 'cd_cartoon_search',
  characterSearch: 'cd_character_search',
  rosterFilters: 'cd_roster_filters',
  messages: 'cd_messages',
  subscribers: 'cd_subscribers',
  quizBest: 'cd_quiz_best'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Safe localStorage read: returns fallback when empty or broken. */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

/** Safe localStorage write. */
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('Storage unavailable', err);
  }
}

/** Escape text before inserting into innerHTML. */
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text === undefined || text === null ? '' : String(text);
  return div.innerHTML;
}

/** Small popup message in the corner of the screen. */
function showToast(message) {
  let toast = $('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ---------- 2. Theme (light / dark) ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#themeToggle');
  if (btn) {
    const dark = theme === 'dark';
    btn.innerHTML = dark
      ? '<span class="theme-icon">&#9728;</span> Light mode'
      : '<span class="theme-icon">&#9790;</span> Dark mode';
    btn.setAttribute('aria-pressed', String(dark));
  }
}

function initTheme() {
  let theme = load(KEYS.theme, null);
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
  const btn = $('#themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      save(KEYS.theme, next);
      applyTheme(next);
    });
  }
}

/* ---------- 3. Navigation & UI effects ---------- */
function initNav() {
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open ? '&#10005;' : '&#9776;';
    });
  }

  // Highlight the current page in the menu
  const current = document.body.dataset.page;
  $$('.nav-link').forEach(link => {
    if (link.dataset.page === current) link.classList.add('active');
  });

  // Show "Login" or "Profile" depending on the session
  const authLink = $('#authLink');
  if (authLink) {
    const user = getCurrentUser();
    if (user) {
      authLink.textContent = user.name.split(' ')[0] + "'s Profile";
      authLink.setAttribute('href', 'profile.html');
      authLink.dataset.page = 'profile';
    } else {
      authLink.textContent = 'Log In';
      authLink.setAttribute('href', 'login.html');
      authLink.dataset.page = 'login';
    }
    if (authLink.dataset.page === current) authLink.classList.add('active');
  }
}

/** Fade-in elements when they scroll into view. */
function initReveal() {
  const items = $$('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach(el => observer.observe(el));
}

/** Click ripple effect on every button. */
function initRipple() {
  document.addEventListener('click', event => {
    const btn = event.target.closest('.btn');
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = event.clientX - rect.left - size / 2 + 'px';
    dot.style.top = event.clientY - rect.top - size / 2 + 'px';
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  });
}

/* ---------- 4. Validators ---------- */
const Validators = {
  required(value, label) {
    return value.trim() === '' ? `${label} is required.` : '';
  },
  name(value) {
    if (value.trim() === '') return 'Full name is required.';
    if (value.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!/^[A-Za-z\u0400-\u04FF\u0600-\u06FF' -]+$/.test(value.trim())) return 'Name can contain only letters, spaces and hyphens.';
    return '';
  },
  email(value) {
    if (value.trim() === '') return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value.trim())) return 'Enter a valid email, for example name@example.com.';
    return '';
  },
  phone(value) {
    if (value.trim() === '') return 'Phone number is required.';
    if (!/^\+?[0-9\s\-()]+$/.test(value.trim())) return 'Phone can contain only digits, spaces, +, - and parentheses.';
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return 'Phone number must have 10 to 15 digits, e.g. +7 701 123 4567.';
    return '';
  },
  password(value) {
    if (value === '') return 'Password is required.';
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(value)) return 'Add at least one uppercase letter.';
    if (!/[a-z]/.test(value)) return 'Add at least one lowercase letter.';
    if (!/[0-9]/.test(value)) return 'Add at least one number.';
    if (!/[^A-Za-z0-9]/.test(value)) return 'Add at least one special character (e.g. ! @ # $).';
    return '';
  },
  confirm(value, original) {
    if (value === '') return 'Please confirm your password.';
    if (value !== original) return 'Passwords do not match.';
    return '';
  },
  message(value) {
    if (value.trim() === '') return 'Message is required.';
    if (value.trim().length < 10) return 'Message must be at least 10 characters.';
    return '';
  }
};

/** Show or clear an error under a field. Returns true when valid. */
function setFieldState(input, errorText) {
  const errorEl = $('#' + input.id + 'Error');
  if (errorEl) errorEl.textContent = errorText;
  input.classList.toggle('invalid', errorText !== '');
  input.classList.toggle('valid', errorText === '' && input.value !== '');
  input.setAttribute('aria-invalid', errorText !== '' ? 'true' : 'false');
  return errorText === '';
}

/**
 * Attach live validation to a form.
 * rules: { fieldId: () => 'error text' or '' }
 * Returns a function that validates everything at once.
 */
function attachValidation(form, rules) {
  Object.keys(rules).forEach(id => {
    const input = $('#' + id, form);
    if (!input) return;
    let touched = false;
    input.addEventListener('blur', () => { touched = true; setFieldState(input, rules[id]()); });
    input.addEventListener('input', () => { if (touched) setFieldState(input, rules[id]()); });
  });
  return function validateAll() {
    let allValid = true;
    let firstBad = null;
    Object.keys(rules).forEach(id => {
      const input = $('#' + id, form);
      if (!input) return;
      const ok = setFieldState(input, rules[id]());
      if (!ok) {
        allValid = false;
        if (!firstBad) firstBad = input;
      }
    });
    if (firstBad) {
      firstBad.focus();
      form.classList.remove('shake');
      void form.offsetWidth; // restart animation
      form.classList.add('shake');
    }
    return allValid;
  };
}

function setStatus(el, text, ok) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('ok', ok === true);
  el.classList.toggle('bad', ok === false);
}

/* ---------- 5. Authentication simulation ---------- */
function getUsers() { return load(KEYS.users, []); }

function getCurrentUser() {
  const email = load(KEYS.session, null);
  if (!email) return null;
  return getUsers().find(u => u.email === email) || null;
}

function initSignup() {
  const form = $('#signupForm');
  if (!form) return;
  const f = id => $('#' + id, form);

  const validateAll = attachValidation(form, {
    signupName: () => Validators.name(f('signupName').value),
    signupEmail: () => Validators.email(f('signupEmail').value),
    signupPhone: () => Validators.phone(f('signupPhone').value),
    signupPassword: () => Validators.password(f('signupPassword').value),
    signupConfirm: () => Validators.confirm(f('signupConfirm').value, f('signupPassword').value)
  });

  // Password strength meter
  const bar = $('#strengthBar');
  f('signupPassword').addEventListener('input', () => {
    const v = f('signupPassword').value;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[a-z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const colors = ['#b3261e', '#d9622b', '#d9a42b', '#7aa83c', '#1f7a4d'];
    bar.style.width = (score * 20) + '%';
    bar.style.background = colors[Math.max(score - 1, 0)];
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = $('#signupStatus');
    if (!validateAll()) { setStatus(status, 'Please fix the highlighted fields.', false); return; }

    const email = f('signupEmail').value.trim().toLowerCase();
    const users = getUsers();
    if (users.some(u => u.email === email)) {
      setFieldState(f('signupEmail'), 'An account with this email already exists.');
      setStatus(status, 'This email is already registered. Try logging in.', false);
      return;
    }
    users.push({
      name: f('signupName').value.trim(),
      email,
      phone: f('signupPhone').value.trim(),
      password: f('signupPassword').value, // demo only: real sites never store plain passwords
      createdAt: new Date().toISOString()
    });
    save(KEYS.users, users);
    setStatus(status, 'Account created! Redirecting to the login page...', true);
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  });
}

function initLogin() {
  const form = $('#loginForm');
  if (!form) return;
  const f = id => $('#' + id, form);

  const validateAll = attachValidation(form, {
    loginEmail: () => Validators.email(f('loginEmail').value),
    loginPassword: () => Validators.required(f('loginPassword').value, 'Password')
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = $('#loginStatus');
    if (!validateAll()) { setStatus(status, 'Please fix the highlighted fields.', false); return; }

    const email = f('loginEmail').value.trim().toLowerCase();
    const password = f('loginPassword').value;
    const user = getUsers().find(u => u.email === email);

    if (!user) {
      setStatus(status, 'No account found with this email. Please sign up first.', false);
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      return;
    }
    if (user.password !== password) {
      setFieldState(f('loginPassword'), 'Incorrect password.');
      setStatus(status, 'Incorrect password. Please try again.', false);
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      return;
    }
    save(KEYS.session, user.email);
    setStatus(status, 'Welcome back, ' + user.name.split(' ')[0] + '! Opening your profile...', true);
    setTimeout(() => { window.location.href = 'profile.html'; }, 900);
  });
}

/* ---------- 6. Profile page ---------- */
function initProfile() {
  const root = $('#profileRoot');
  if (!root) return;
  const user = getCurrentUser();

  if (!user) {
    // Not logged in: show a friendly message instead of the profile
    root.innerHTML = `
      <div class="state-box">
        <h2>You are not logged in</h2>
        <p>Please log in to see your profile.</p>
        <a class="btn" href="login.html">Go to Log In</a>
        <a class="btn btn-outline" href="signup.html">Create Account</a>
      </div>`;
    return;
  }

  const joined = new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const favorites = load(KEYS.favorites, []);
  const lastCartoon = load(KEYS.cartoonSearch, null);

  root.innerHTML = `
    <div class="panel profile-card">
      <div class="avatar" aria-hidden="true">${esc(user.name.charAt(0).toUpperCase())}</div>
      <div>
        <h2 style="margin:0;color:var(--heading);font-size:2.4rem;">${esc(user.name)}</h2>
        <ul class="detail-list">
          <li><strong>Email:</strong> ${esc(user.email)}</li>
          <li><strong>Phone:</strong> ${esc(user.phone)}</li>
          <li><strong>Member since:</strong> ${esc(joined)}</li>
          <li><strong>Saved favourites:</strong> ${favorites.length}</li>
          <li><strong>Last cartoon search:</strong> ${lastCartoon && lastCartoon.query ? esc(lastCartoon.query) : 'none yet'}</li>
        </ul>
        <p style="margin-top:18px"><button id="logoutBtn" class="btn" type="button"><span class="btn-icon">&#10140;</span> Log Out</button></p>
      </div>
    </div>
    <h2 class="section-title" style="margin-top:50px">My Favourite Characters</h2>
    <div id="profileFavorites" class="grid grid-4"></div>`;

  $('#logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(KEYS.session);
    window.location.href = 'index.html';
  });

  renderProfileFavorites();
}

function renderProfileFavorites() {
  const box = $('#profileFavorites');
  if (!box) return;
  const favorites = load(KEYS.favorites, []);
  if (favorites.length === 0) {
    box.innerHTML = '<div class="state-box" style="grid-column:1/-1">No favourites yet. Visit the <a href="characters.html">Characters</a> or <a href="cartoons.html">Cartoons</a> page and press the heart!</div>';
    return;
  }
  box.innerHTML = favorites.map(item => `
    <article class="card">
      <div class="card-img-wrap"><img class="card-img" src="${esc(item.img)}" alt="${esc(item.name)}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.svg'"></div>
      <div class="card-body">
        <h3 class="card-title">${esc(item.name)}</h3>
        <span class="tag">${esc(item.type)}</span>
        <div class="card-actions"><button class="btn btn-small btn-outline" data-remove="${esc(item.id)}" type="button">Remove</button></div>
      </div>
    </article>`).join('');
  $$('[data-remove]', box).forEach(btn => btn.addEventListener('click', () => {
    toggleFavorite({ id: btn.dataset.remove });
    renderProfileFavorites();
    const count = $('.detail-list li:nth-child(4)');
    if (count) count.innerHTML = '<strong>Saved favourites:</strong> ' + load(KEYS.favorites, []).length;
  }));
}

/* Favourites (shared by cartoons, characters and profile pages) */
function isFavorite(id) { return load(KEYS.favorites, []).some(f => String(f.id) === String(id)); }

function toggleFavorite(item) {
  let favorites = load(KEYS.favorites, []);
  const exists = favorites.some(f => String(f.id) === String(item.id));
  if (exists) {
    favorites = favorites.filter(f => String(f.id) !== String(item.id));
    showToast('Removed from favourites');
  } else {
    favorites.push(item);
    showToast('Added to favourites \u2764');
  }
  save(KEYS.favorites, favorites);
  return !exists;
}

/* ---------- 7. Contact + newsletter forms ---------- */
function initContact() {
  const form = $('#contactForm');
  if (!form) return;
  const f = id => $('#' + id, form);

  const validateAll = attachValidation(form, {
    contactName: () => Validators.name(f('contactName').value),
    contactEmail: () => Validators.email(f('contactEmail').value),
    contactPhone: () => Validators.phone(f('contactPhone').value),
    contactSubject: () => Validators.required(f('contactSubject').value, 'Subject'),
    contactMessage: () => Validators.message(f('contactMessage').value)
  });

  // Pre-fill from the logged-in user
  const user = getCurrentUser();
  if (user) {
    f('contactName').value = user.name;
    f('contactEmail').value = user.email;
    f('contactPhone').value = user.phone;
  }

  const counter = $('#messageCounter');
  f('contactMessage').addEventListener('input', () => {
    counter.textContent = f('contactMessage').value.length + ' characters';
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = $('#contactStatus');
    if (!validateAll()) { setStatus(status, 'Please fix the highlighted fields.', false); return; }
    const messages = load(KEYS.messages, []);
    messages.push({
      name: f('contactName').value.trim(),
      email: f('contactEmail').value.trim(),
      phone: f('contactPhone').value.trim(),
      subject: f('contactSubject').value.trim(),
      message: f('contactMessage').value.trim(),
      sentAt: new Date().toISOString()
    });
    save(KEYS.messages, messages);
    setStatus(status, 'Thank you! Your message was sent (saved locally in this demo).', true);
    form.reset();
    counter.textContent = '0 characters';
    $$('.input', form).forEach(i => i.classList.remove('valid', 'invalid'));
    showToast('Message sent \u2728');
  });

  $('#contactReset').addEventListener('click', () => {
    form.reset();
    $$('.error-msg', form).forEach(e => { e.textContent = ''; });
    $$('.input', form).forEach(i => i.classList.remove('valid', 'invalid'));
    setStatus($('#contactStatus'), '', null);
    counter.textContent = '0 characters';
  });
}

function initNewsletter() {
  const form = $('#newsletterForm');
  if (!form) return;
  const f = id => $('#' + id, form);
  const validateAll = attachValidation(form, {
    newsName: () => Validators.name(f('newsName').value),
    newsEmail: () => Validators.email(f('newsEmail').value)
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const status = $('#newsStatus');
    if (!validateAll()) { setStatus(status, 'Please fix the highlighted fields.', false); return; }
    const subs = load(KEYS.subscribers, []);
    const email = f('newsEmail').value.trim().toLowerCase();
    if (subs.some(s => s.email === email)) {
      setStatus(status, 'This email is already subscribed.', false);
      return;
    }
    subs.push({ name: f('newsName').value.trim(), email });
    save(KEYS.subscribers, subs);
    setStatus(status, 'You are subscribed. Welcome to Cartoon Dreamland!', true);
    form.reset();
    $$('.input', form).forEach(i => i.classList.remove('valid'));
  });
}

/* ---------- 8. Cartoon library (search / filter / sort) ---------- */
const CARTOONS = [
  { id: 'tom-jerry', title: 'Tom and Jerry', year: 1940, genre: 'Comedy', studio: 'MGM', text: 'A cat and a mouse chase each other through endless slapstick adventures.' },
  { id: 'mickey', title: 'Steamboat Willie', year: 1928, genre: 'Classic', studio: 'Disney', text: 'The classic short that introduced Mickey Mouse to the world.' },
  { id: 'looney', title: 'Looney Tunes', year: 1930, genre: 'Comedy', studio: 'Warner Bros.', text: 'Bugs Bunny, Daffy Duck and friends in laugh-out-loud gags.' },
  { id: 'scooby', title: 'Scooby-Doo, Where Are You!', year: 1969, genre: 'Mystery', studio: 'Hanna-Barbera', text: 'A talking dog and his friends solve spooky mysteries.' },
  { id: 'flintstones', title: 'The Flintstones', year: 1960, genre: 'Family', studio: 'Hanna-Barbera', text: 'A stone-age family with modern-day problems in Bedrock.' },
  { id: 'simpsons', title: 'The Simpsons', year: 1989, genre: 'Family', studio: 'Fox', text: 'The longest-running animated sitcom about a yellow family in Springfield.' },
  { id: 'ducktales', title: 'DuckTales', year: 1987, genre: 'Adventure', studio: 'Disney', text: 'Scrooge McDuck and his nephews hunt treasure around the globe.' },
  { id: 'pokemon', title: 'Pokemon', year: 1997, genre: 'Adventure', studio: 'OLM', text: 'Ash travels the world to catch and train pocket monsters.' },
  { id: 'dexter', title: "Dexter's Laboratory", year: 1996, genre: 'Sci-Fi', studio: 'Cartoon Network', text: 'A boy genius fights to keep his secret lab safe from his sister.' },
  { id: 'spongebob', title: 'SpongeBob SquarePants', year: 1999, genre: 'Comedy', studio: 'Nickelodeon', text: 'A cheerful sea sponge lives in the underwater city of Bikini Bottom.' },
  { id: 'powerpuff', title: 'The Powerpuff Girls', year: 1998, genre: 'Adventure', studio: 'Cartoon Network', text: 'Three super-powered sisters protect the city of Townsville.' },
  { id: 'avatar', title: 'Avatar: The Last Airbender', year: 2005, genre: 'Fantasy', studio: 'Nickelodeon', text: 'A young airbender must master four elements to bring balance to the world.' },
  { id: 'phineas', title: 'Phineas and Ferb', year: 2007, genre: 'Comedy', studio: 'Disney', text: 'Two brothers build amazing inventions every summer day.' },
  { id: 'adventure-time', title: 'Adventure Time', year: 2010, genre: 'Fantasy', studio: 'Cartoon Network', text: 'Finn and Jake explore the magical Land of Ooo.' },
  { id: 'gravity-falls', title: 'Gravity Falls', year: 2012, genre: 'Mystery', studio: 'Disney', text: 'Twins spend a summer uncovering strange secrets in a mysterious town.' },
  { id: 'steven', title: 'Steven Universe', year: 2013, genre: 'Fantasy', studio: 'Cartoon Network', text: 'A boy and the magical Crystal Gems protect Earth.' },
  { id: 'bluey', title: 'Bluey', year: 2018, genre: 'Family', studio: 'Ludo Studio', text: 'A playful puppy and her family turn everyday life into imaginative games.' },
  { id: 'arcane', title: 'Arcane', year: 2021, genre: 'Fantasy', studio: 'Fortiche', text: 'Two sisters are caught on opposite sides of a conflict between two cities.' }
];

function decadeOf(year) { return Math.floor(year / 10) * 10 + 's'; }

function initCartoons() {
  const list = $('#cartoonList');
  if (!list) return;
  const searchEl = $('#cartoonSearch');
  const genreEl = $('#cartoonGenre');
  const decadeEl = $('#cartoonDecade');
  const sortEl = $('#cartoonSort');
  const infoEl = $('#cartoonInfo');
  const emptyEl = $('#cartoonEmpty');

  // Fill the genre and decade selects from the data
  [...new Set(CARTOONS.map(c => c.genre))].sort().forEach(g => genreEl.insertAdjacentHTML('beforeend', `<option value="${esc(g)}">${esc(g)}</option>`));
  [...new Set(CARTOONS.map(c => decadeOf(c.year)))].sort().forEach(d => decadeEl.insertAdjacentHTML('beforeend', `<option value="${esc(d)}">${esc(d)}</option>`));

  // Restore the last saved search from localStorage
  const saved = load(KEYS.cartoonSearch, null);
  if (saved) {
    searchEl.value = saved.query || '';
    genreEl.value = saved.genre || 'all';
    decadeEl.value = saved.decade || 'all';
    sortEl.value = saved.sort || 'year-asc';
  }

  function render() {
    const query = searchEl.value.trim().toLowerCase();
    let results = CARTOONS.filter(c => {
      const matchText = !query || (c.title + ' ' + c.text + ' ' + c.studio).toLowerCase().includes(query);
      const matchGenre = genreEl.value === 'all' || c.genre === genreEl.value;
      const matchDecade = decadeEl.value === 'all' || decadeOf(c.year) === decadeEl.value;
      return matchText && matchGenre && matchDecade;
    });

    const sorters = {
      'year-asc': (a, b) => a.year - b.year,
      'year-desc': (a, b) => b.year - a.year,
      'title': (a, b) => a.title.localeCompare(b.title)
    };
    results.sort(sorters[sortEl.value] || sorters['year-asc']);

    save(KEYS.cartoonSearch, { query: searchEl.value.trim(), genre: genreEl.value, decade: decadeEl.value, sort: sortEl.value });

    infoEl.textContent = `Showing ${results.length} of ${CARTOONS.length} cartoons`;
    emptyEl.hidden = results.length !== 0;

    list.innerHTML = results.map(c => {
      const fav = isFavorite('cartoon-' + c.id);
      return `
      <article class="card">
        <div class="card-img-wrap"><img class="card-img" data-poster-for="${esc(c.id)}" src="${esc(posterImg(c.id))}" alt="Poster of ${esc(c.title)}" loading="lazy" onerror="this.onerror=null;this.src='images/posters/poster-${esc(c.id)}.png'"></div>
        <div class="card-body">
          <span class="poster-year">${c.year} &middot; ${esc(decadeOf(c.year))}</span>
          <h3 class="card-title">${esc(c.title)}</h3>
          <div class="tag-row"><span class="tag">${esc(c.genre)}</span><span class="tag">${esc(c.studio)}</span></div>
          <p class="card-text">${esc(c.text)}</p>
          <div class="card-actions">
            <button class="fav-btn ${fav ? 'active' : ''}" type="button" data-fav="${esc(c.id)}" aria-pressed="${fav}"><span class="heart">&#10084;</span> ${fav ? 'Saved' : 'Save'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
    upgradePosterImages(results.map(c => c.id));

    $$('[data-fav]', list).forEach(btn => btn.addEventListener('click', () => {
      const c = CARTOONS.find(x => x.id === btn.dataset.fav);
      toggleFavorite({ id: 'cartoon-' + c.id, name: c.title, img: posterImg(c.id), type: 'Cartoon' });
      render();
    }));
  }

  searchEl.addEventListener('input', render);
  [genreEl, decadeEl, sortEl].forEach(el => el.addEventListener('change', render));
  $('#cartoonClear').addEventListener('click', () => {
    searchEl.value = ''; genreEl.value = 'all'; decadeEl.value = 'all'; sortEl.value = 'year-asc';
    render();
  });
  render();
}

/* ---------- 9. Characters (external Disney API) ---------- */
const API_URL = 'https://api.disneyapi.dev/character';
/** Returns the custom image link from js/images-config.js, or the default picture. */
function pickImage(map, id, fallback) {
  const custom = (typeof map !== 'undefined' && map && typeof map[id] === 'string') ? map[id].trim() : '';
  return custom || fallback;
}
// Real pictures found automatically on Wikipedia are remembered in localStorage
const WIKI_CACHE_KEY = 'cd_wiki_images';
let wikiCache = {};
try { wikiCache = JSON.parse(localStorage.getItem(WIKI_CACHE_KEY)) || {}; } catch (e) { wikiCache = {}; }
// Priority: 1) link typed in js/images-config.js  2) real picture from Wikipedia  3) drawn picture
const rosterImg = c => pickImage(typeof CHARACTER_IMAGES !== 'undefined' ? CHARACTER_IMAGES : null, c.id, wikiCache[c.id] || c.img);

/** Looks up the real picture of one character via the Wikipedia REST API (no key needed). */
async function fetchRealImage(c) {
  const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.wiki.replace(/ /g, '_'));
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return (json.thumbnail && json.thumbnail.source) || (json.originalimage && json.originalimage.source) || '';
}
/** Upgrades the drawn pictures on screen to real ones, a few at a time. Failures keep the drawing. */
async function upgradeRosterImages(characters) {
  const todo = characters.filter(c => c.wiki && !(c.id in wikiCache));
  let index = 0;
  async function worker() {
    while (index < todo.length) {
      const c = todo[index++];
      try {
        wikiCache[c.id] = await fetchRealImage(c);
        try { localStorage.setItem(WIKI_CACHE_KEY, JSON.stringify(wikiCache)); } catch (e) { /* storage full: ignore */ }
        if (!wikiCache[c.id]) continue;
        document.querySelectorAll(`[data-img-for="${c.id}"]`).forEach(img => { img.src = rosterImg(c); });
      } catch (err) { /* offline or not found: keep the drawn picture */ }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
}
// Wikipedia article for each cartoon (used to load the real picture automatically)
const CARTOON_WIKI = {
  'tom-jerry': 'Tom and Jerry', 'mickey': 'Steamboat Willie', 'looney': 'Looney Tunes', 'scooby': 'Scooby-Doo, Where Are You!',
  'flintstones': 'The Flintstones', 'simpsons': 'The Simpsons', 'ducktales': 'DuckTales (1987 TV series)', 'pokemon': 'Pokémon (TV series)',
  'spongebob': 'SpongeBob SquarePants', 'powerpuff': 'The Powerpuff Girls', 'avatar': 'Avatar: The Last Airbender', 'phineas': 'Phineas and Ferb',
  'adventure-time': 'Adventure Time', 'gravity-falls': 'Gravity Falls', 'steven': 'Steven Universe', 'bluey': 'Bluey (TV series)',
  'arcane': 'Arcane (TV series)', 'dexter': "Dexter's Laboratory"
};
const WIKI_POSTER_KEY = 'cd_wiki_posters';
let posterCache = {};
try { posterCache = JSON.parse(localStorage.getItem(WIKI_POSTER_KEY)) || {}; } catch (e) { posterCache = {}; }
const posterImg = id => pickImage(typeof CARTOON_IMAGES !== 'undefined' ? CARTOON_IMAGES : null, id, posterCache[id] || 'images/posters/poster-' + id + '.png');
async function upgradePosterImages(ids) {
  const todo = ids.filter(id => CARTOON_WIKI[id] && !(id in posterCache));
  await Promise.all(todo.map(async id => {
    try {
      posterCache[id] = await fetchRealImage({ wiki: CARTOON_WIKI[id] });
      try { localStorage.setItem(WIKI_POSTER_KEY, JSON.stringify(posterCache)); } catch (e) { /* ignore */ }
      if (posterCache[id]) document.querySelectorAll(`[data-poster-for="${id}"]`).forEach(img => { img.src = posterImg(id); });
    } catch (err) { /* keep default picture */ }
  }));
}

const MAX_API_PAGES = 15; // limit pagination so the list stays short and easy to browse

// Offline sample used only if the API cannot be reached
const FALLBACK_CHARACTERS = [
  { _id: 'f1', name: 'Mickey Mouse', imageUrl: 'images/char-mickey.svg', films: ['Fantasia'], tvShows: ['Mickey Mouse Clubhouse'], videoGames: ['Kingdom Hearts'] },
  { _id: 'f2', name: 'Donald Duck', imageUrl: 'images/char-donald.svg', films: ['The Three Caballeros'], tvShows: ['DuckTales'], videoGames: [] },
  { _id: 'f3', name: 'Goofy', imageUrl: 'images/char-goofy.svg', films: ['A Goofy Movie'], tvShows: ['Goof Troop'], videoGames: ['Kingdom Hearts'] },
  { _id: 'f4', name: 'Minnie Mouse', imageUrl: 'images/char-minnie.svg', films: [], tvShows: ['Mickey Mouse Clubhouse'], videoGames: [] },
  { _id: 'f5', name: 'Pluto', imageUrl: 'images/char-pluto.svg', films: [], tvShows: ['Mickey Mouse Works'], videoGames: [] },
  { _id: 'f6', name: 'Stitch', imageUrl: 'images/char-stitch.svg', films: ['Lilo & Stitch'], tvShows: ['Stitch!'], videoGames: [] }
];

function characterType(ch) {
  if (ch.films && ch.films.length) return 'Film';
  if (ch.tvShows && ch.tvShows.length) return 'TV Show';
  if (ch.videoGames && ch.videoGames.length) return 'Video Game';
  return 'Character';
}

/** Fetch characters from the API with a timeout. */
async function fetchCharacters(query, page) {
  const params = new URLSearchParams({ pageSize: '24', page: String(page || 1) });
  if (query) params.set('name', query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(API_URL + '?' + params.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error('Server answered with status ' + response.status);
    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);
    // The API reports ~410 pages; we cap it at 50 pages to keep browsing simple
    return { data, totalPages: Math.min((json.info && json.info.totalPages) || 1, MAX_API_PAGES) };
  } finally {
    clearTimeout(timer);
  }
}

function initCharacters() {
  const list = $('#characterList');
  if (!list) return;
  const searchEl = $('#characterSearch');
  const typeEl = $('#characterType');
  const stateEl = $('#characterState');
  const infoEl = $('#characterInfo');
  const prevBtn = $('#prevPage');
  const nextBtn = $('#nextPage');
  const pageLabel = $('#pageLabel');
  const modalBackdrop = $('#characterModal');

  let page = 1;
  let totalPages = 1;
  let characters = [];
  let usingFallback = false;

  const saved = load(KEYS.characterSearch, null);
  if (saved) {
    searchEl.value = saved.query || '';
    typeEl.value = saved.type || 'all';
  }

  function showLoading() {
    stateEl.hidden = false;
    stateEl.className = 'state-box';
    stateEl.innerHTML = '<div class="spinner" role="status"></div><p>Loading characters from the Disney API...</p>';
    list.innerHTML = '';
  }

  function showError(message) {
    stateEl.hidden = false;
    stateEl.className = 'state-box error';
    stateEl.innerHTML = `<p><strong>Oops!</strong> ${esc(message)}</p><button class="btn btn-small" id="retryBtn" type="button">Try again</button>`;
    $('#retryBtn').addEventListener('click', () => loadPage());
  }

  function renderCards() {
    const filter = typeEl.value;
    const shown = characters.filter(ch => {
      if (filter === 'films') return ch.films && ch.films.length;
      if (filter === 'tvShows') return ch.tvShows && ch.tvShows.length;
      if (filter === 'videoGames') return ch.videoGames && ch.videoGames.length;
      return true;
    });

    infoEl.textContent = usingFallback
      ? `Showing ${shown.length} offline sample characters (API unreachable)`
      : `Showing ${shown.length} characters \u00b7 page ${page} of ${totalPages}`;

    if (shown.length === 0) {
      stateEl.hidden = false;
      stateEl.className = 'state-box';
      stateEl.innerHTML = '<p>No characters found. Try another name or filter.</p>';
      list.innerHTML = '';
      return;
    }
    stateEl.hidden = true;

    list.innerHTML = shown.map(ch => {
      const id = 'char-' + ch._id;
      const fav = isFavorite(id);
      const img = ch.imageUrl || 'images/placeholder.svg';
      const source = (ch.films && ch.films[0]) || (ch.tvShows && ch.tvShows[0]) || (ch.videoGames && ch.videoGames[0]) || 'Disney universe';
      return `
      <article class="card">
        <div class="card-img-wrap"><img class="card-img" src="${esc(img)}" alt="${esc(ch.name)}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholder.svg'"></div>
        <div class="card-body">
          <h3 class="card-title">${esc(ch.name)}</h3>
          <div class="tag-row"><span class="tag">${esc(characterType(ch))}</span></div>
          <p class="card-text">Appears in: ${esc(source)}</p>
          <div class="card-actions">
            <button class="btn btn-small" type="button" data-details="${esc(ch._id)}">Details</button>
            <button class="fav-btn ${fav ? 'active' : ''}" type="button" data-fav="${esc(ch._id)}" aria-pressed="${fav}"><span class="heart">&#10084;</span> ${fav ? 'Saved' : 'Save'}</button>
          </div>
        </div>
      </article>`;
    }).join('');

    $$('[data-fav]', list).forEach(btn => btn.addEventListener('click', () => {
      const ch = characters.find(c => String(c._id) === btn.dataset.fav);
      toggleFavorite({ id: 'char-' + ch._id, name: ch.name, img: ch.imageUrl || 'images/placeholder.svg', type: characterType(ch) });
      renderCards();
    }));
    $$('[data-details]', list).forEach(btn => btn.addEventListener('click', () => {
      openModal(characters.find(c => String(c._id) === btn.dataset.details));
    }));
  }

  function openModal(ch) {
    const joinList = arr => (arr && arr.length ? arr.slice(0, 6).map(esc).join(', ') : 'none listed');
    $('#modalContent').innerHTML = `
      <img src="${esc(ch.imageUrl || 'images/placeholder.svg')}" alt="${esc(ch.name)}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
      <h2 id="modalTitle">${esc(ch.name)}</h2>
      <p><strong>Films:</strong> ${joinList(ch.films)}</p>
      <p><strong>TV shows:</strong> ${joinList(ch.tvShows)}</p>
      <p><strong>Video games:</strong> ${joinList(ch.videoGames)}</p>
      ${ch.allies && ch.allies.length ? `<p><strong>Allies:</strong> ${joinList(ch.allies)}</p>` : ''}
      ${ch.enemies && ch.enemies.length ? `<p><strong>Enemies:</strong> ${joinList(ch.enemies)}</p>` : ''}`;
    modalBackdrop.classList.add('show');
    $('#modalClose').focus();
  }
  function closeModal() { modalBackdrop.classList.remove('show'); }
  $('#modalClose').addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  async function loadPage() {
    showLoading();
    prevBtn.disabled = nextBtn.disabled = true;
    try {
      const result = await fetchCharacters(searchEl.value.trim(), page);
      characters = result.data;
      totalPages = result.totalPages;
      usingFallback = false;
      renderCards();
    } catch (err) {
      console.error(err);
      // Show the error message, then keep the page useful with offline samples
      characters = FALLBACK_CHARACTERS.filter(c => c.name.toLowerCase().includes(searchEl.value.trim().toLowerCase()));
      totalPages = 1;
      usingFallback = true;
      renderCards();
      stateEl.hidden = false;
      stateEl.className = 'state-box error';
      stateEl.innerHTML = `<p><strong>Could not load data from the API.</strong> ${esc(err.name === 'AbortError' ? 'The request took too long.' : 'Check your internet connection.')} Offline samples are shown below.</p><button class="btn btn-small" id="retryBtn" type="button">Try again</button>`;
      $('#retryBtn').addEventListener('click', () => loadPage());
    }
    pageLabel.textContent = `Page ${page} / ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  }

  // Search with a short delay so we do not call the API on every key press
  let debounce;
  searchEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      page = 1;
      save(KEYS.characterSearch, { query: searchEl.value.trim(), type: typeEl.value });
      loadPage();
    }, 450);
  });
  typeEl.addEventListener('change', () => {
    save(KEYS.characterSearch, { query: searchEl.value.trim(), type: typeEl.value });
    renderCards();
  });
  prevBtn.addEventListener('click', () => { if (page > 1) { page--; loadPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  nextBtn.addEventListener('click', () => { if (page < totalPages) { page++; loadPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  $('#characterClear').addEventListener('click', () => {
    searchEl.value = ''; typeEl.value = 'all'; page = 1;
    save(KEYS.characterSearch, { query: '', type: 'all' });
    loadPage();
  });

  loadPage();
}


/* ---------- 9b. The Dreamland 50 (local roster: search, filter, sort, save) ---------- */
function initRoster() {
  const list = $('#rosterList');
  if (!list || typeof ROSTER === 'undefined') return;
  const searchEl = $('#rosterSearch'), showEl = $('#rosterShow'), roleEl = $('#rosterRole'), sortEl = $('#rosterSort');
  const infoEl = $('#rosterInfo'), emptyEl = $('#rosterEmpty'), favBtn = $('#rosterFavOnly'), modal = $('#rosterModal');
  let favOnly = false;

  // Fill the dropdowns from the data so they never get out of sync
  [...new Set(ROSTER.map(c => c.show))].sort().forEach(s => showEl.insertAdjacentHTML('beforeend', `<option value="${esc(s)}">${esc(s)}</option>`));
  [...new Set(ROSTER.map(c => c.role))].sort().forEach(r => roleEl.insertAdjacentHTML('beforeend', `<option value="${esc(r)}">${esc(r)}</option>`));

  // Restore the last filters from localStorage
  const saved = load(KEYS.rosterFilters, null);
  if (saved) {
    searchEl.value = saved.q || '';
    if ([...showEl.options].some(o => o.value === saved.show)) showEl.value = saved.show;
    if ([...roleEl.options].some(o => o.value === saved.role)) roleEl.value = saved.role;
    if ([...sortEl.options].some(o => o.value === saved.sort)) sortEl.value = saved.sort;
    favOnly = !!saved.favOnly;
  }
  const sorters = {
    'name': (a, b) => a.name.localeCompare(b.name),
    'year-old': (a, b) => a.year - b.year || a.name.localeCompare(b.name),
    'year-new': (a, b) => b.year - a.year || a.name.localeCompare(b.name),
    'show': (a, b) => a.show.localeCompare(b.show) || a.name.localeCompare(b.name)
  };

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    favBtn.setAttribute('aria-pressed', String(favOnly));
    favBtn.classList.toggle('is-on', favOnly);
    save(KEYS.rosterFilters, { q: searchEl.value.trim(), show: showEl.value, role: roleEl.value, sort: sortEl.value, favOnly });
    const shown = ROSTER.filter(c =>
      (!q || c.name.toLowerCase().includes(q) || c.show.toLowerCase().includes(q)) &&
      (showEl.value === 'all' || c.show === showEl.value) &&
      (roleEl.value === 'all' || c.role === roleEl.value) &&
      (!favOnly || isFavorite('roster-' + c.id))
    ).sort(sorters[sortEl.value] || sorters.name);

    infoEl.textContent = `Showing ${shown.length} of ${ROSTER.length} characters`;
    emptyEl.hidden = shown.length > 0;
    list.innerHTML = shown.map(c => {
      const fav = isFavorite('roster-' + c.id);
      return `
      <article class="card char-card" style="--accent:${esc(c.c)}">
        <div class="card-img-wrap"><img class="card-img" data-img-for="${esc(c.id)}" src="${esc(rosterImg(c))}" alt="${esc(c.name)}" width="400" height="400" loading="lazy" onerror="this.onerror=null;this.src='${esc(c.img)}'"></div>
        <div class="card-body">
          <h3 class="card-title">${esc(c.name)}</h3>
          <div class="tag-row"><span class="tag">${esc(c.role)}</span><span class="tag tag-year">${c.year}</span></div>
          <p class="card-text">${esc(c.show)}</p>
          <div class="card-actions">
            <button class="btn btn-small" type="button" data-more="${esc(c.id)}">Details</button>
            <button class="fav-btn ${fav ? 'active' : ''}" type="button" data-save="${esc(c.id)}" aria-pressed="${fav}"><span class="heart">&#10084;</span> ${fav ? 'Saved' : 'Save'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
    upgradeRosterImages(shown);
  }

  list.addEventListener('click', e => {
    const saveBtn = e.target.closest('[data-save]');
    const moreBtn = e.target.closest('[data-more]');
    if (saveBtn) {
      const c = ROSTER.find(x => x.id === saveBtn.dataset.save);
      toggleFavorite({ id: 'roster-' + c.id, name: c.name, img: rosterImg(c), type: c.show });
      render();
    } else if (moreBtn) {
      const c = ROSTER.find(x => x.id === moreBtn.dataset.more);
      $('#rosterModalContent').innerHTML = `
        <img src="${esc(rosterImg(c))}" alt="${esc(c.name)}" width="400" height="400" onerror="this.onerror=null;this.src='${esc(c.img)}'">
        <h2 id="rosterModalTitle">${esc(c.name)}</h2>
        <p>${esc(c.bio)}</p>
        <p><strong>Cartoon:</strong> ${esc(c.show)}</p>
        <p><strong>First appeared:</strong> ${c.year} &middot; <strong>Studio:</strong> ${esc(c.studio)}</p>
        <p><strong>Role:</strong> ${esc(c.role)}</p>`;
      modal.classList.add('show');
      $('#rosterModalClose').focus();
    }
  });
  const closeModal = () => modal.classList.remove('show');
  $('#rosterModalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  searchEl.addEventListener('input', render);
  [showEl, roleEl, sortEl].forEach(el => el.addEventListener('change', render));
  favBtn.addEventListener('click', () => { favOnly = !favOnly; render(); });
  $('#rosterReset').addEventListener('click', () => {
    searchEl.value = ''; showEl.value = 'all'; roleEl.value = 'all'; sortEl.value = 'name'; favOnly = false; render();
  });
  render();
}

/** Home page: "Character of the day" loaded from the same API. */
async function initFeatured() {
  const box = $('#featuredCharacter');
  if (!box) return;
  box.innerHTML = '<div class="state-box" style="grid-column:1/-1"><div class="spinner" role="status"></div><p>Loading a random character...</p></div>';

  async function pick() {
    try {
      const randomPage = Math.floor(Math.random() * 40) + 1;
      const result = await fetchCharacters('', randomPage);
      const withImage = result.data.filter(c => c.imageUrl);
      if (withImage.length === 0) throw new Error('No data');
      const ch = withImage[Math.floor(Math.random() * withImage.length)];
      const source = (ch.films && ch.films[0]) || (ch.tvShows && ch.tvShows[0]) || 'the Disney universe';
      box.innerHTML = `
        <img src="${esc(ch.imageUrl)}" alt="${esc(ch.name)}" onerror="this.onerror=null;this.src='images/placeholder.svg'">
        <div>
          <span class="tag">${esc(characterType(ch))}</span>
          <h3 style="margin:8px 0;color:var(--heading);font-size:2.2rem">${esc(ch.name)}</h3>
          <p class="muted">Seen in: ${esc(source)}</p>
          <button class="btn btn-small" id="anotherBtn" type="button"><span class="btn-icon">&#8635;</span> Another one</button>
          <a class="btn btn-small btn-outline" href="characters.html">Browse all</a>
        </div>`;
      $('#anotherBtn').addEventListener('click', () => { initFeatured(); });
    } catch (err) {
      console.error(err);
      box.innerHTML = '<div class="state-box error" style="grid-column:1/-1"><p>Could not load a character right now.</p><button class="btn btn-small" id="retryFeatured" type="button">Try again</button></div>';
      $('#retryFeatured').addEventListener('click', initFeatured);
    }
  }
  pick();
}

/* ---------- 10. Gallery, FAQ, quiz ---------- */
function initGallery() {
  const main = $('#galleryMain');
  if (!main) return;
  const caption = $('#galleryCaption');
  $$('.thumb').forEach(btn => btn.addEventListener('click', () => {
    $$('.thumb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    main.style.opacity = '0';
    setTimeout(() => {
      main.src = btn.dataset.full;
      main.alt = btn.dataset.caption;
      caption.textContent = btn.dataset.caption;
      main.style.opacity = '1';
    }, 200);
  }));
}

function initFaq() {
  $$('.acc-btn').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.acc-item');
    const wasOpen = item.classList.contains('open');
    $$('.acc-item').forEach(i => { i.classList.remove('open'); $('.acc-btn', i).setAttribute('aria-expanded', 'false'); });
    if (!wasOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  }));
}

const QUIZ = [
  { q: 'Which pair chases each other in a famous 1940 cartoon?', a: ['Tom and Jerry', 'Pluto and Goofy', 'Bugs and Daffy'], c: 0 },
  { q: 'Who lives in a pineapple under the sea?', a: ['Patrick Star', 'SpongeBob SquarePants', 'Squidward'], c: 1 },
  { q: 'What is the name of the talking dog who solves mysteries?', a: ['Scooby-Doo', 'Pluto', 'Odie'], c: 0 },
  { q: 'Which cartoon mouse first appeared in Steamboat Willie?', a: ['Jerry', 'Speedy Gonzales', 'Mickey Mouse'], c: 2 },
  { q: 'In Avatar: The Last Airbender, how many elements must Aang master?', a: ['Three', 'Four', 'Five'], c: 1 }
];

function initQuiz() {
  const box = $('#quizBox');
  if (!box) return;
  let index = 0;
  let score = 0;

  function renderQuestion() {
    const item = QUIZ[index];
    box.innerHTML = `
      <p class="muted">Question ${index + 1} of ${QUIZ.length} &middot; Score: ${score}</p>
      <h3 style="margin:0;color:var(--heading);font-size:1.8rem">${esc(item.q)}</h3>
      <div class="quiz-options">${item.a.map((opt, i) => `<button class="quiz-opt" type="button" data-i="${i}">${esc(opt)}</button>`).join('')}</div>
      <p id="quizFeedback" class="form-status" aria-live="polite"></p>`;
    $$('.quiz-opt', box).forEach(btn => btn.addEventListener('click', () => answer(Number(btn.dataset.i))));
  }

  function answer(choice) {
    const item = QUIZ[index];
    $$('.quiz-opt', box).forEach((btn, i) => {
      btn.disabled = true;
      if (i === item.c) btn.classList.add('correct');
      else if (i === choice) btn.classList.add('wrong');
    });
    const feedback = $('#quizFeedback');
    if (choice === item.c) { score++; setStatus(feedback, 'Correct! \u2728', true); }
    else setStatus(feedback, 'Not quite. The right answer is highlighted.', false);
    setTimeout(() => { index++; index < QUIZ.length ? renderQuestion() : renderResult(); }, 1200);
  }

  function renderResult() {
    const best = Math.max(load(KEYS.quizBest, 0), score);
    save(KEYS.quizBest, best);
    box.innerHTML = `
      <h3 style="margin:0;color:var(--heading);font-size:2.2rem">You scored ${score} / ${QUIZ.length}</h3>
      <p class="muted">Your best score on this device: ${best} / ${QUIZ.length}</p>
      <button class="btn" id="quizRestart" type="button"><span class="btn-icon">&#8635;</span> Play again</button>`;
    $('#quizRestart').addEventListener('click', () => { index = 0; score = 0; renderQuestion(); });
  }
  renderQuestion();
}

/* ---------- 11. Page initialisation ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initRipple();
  initSignup();
  initLogin();
  initProfile();
  initContact();
  initNewsletter();
  initCartoons();
  initRoster();
  initCharacters();
  initFeatured();
  initGallery();
  initFaq();
  initQuiz();
  initReveal();
});
