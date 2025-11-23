document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'pomodoro:todos';

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  // Create panel
  const panel = document.createElement('aside');
  panel.className = 'todo-panel';
  panel.innerHTML = `
    <header class="todo-header">
      <h3>To‑Do</h3>
      <div class="todo-tabs">
        <button data-tab="active" class="active">Active</button>
        <button data-tab="archive">Archive</button>
      </div>
    </header>
    <section class="todo-body">
      <div class="todo-add">
        <input id="todo-input" placeholder="Add a task" />
        <button id="todo-add-btn">Add</button>
      </div>
      <ul id="todo-list" class="todo-list"></ul>
      <div id="todo-empty" class="todo-empty">No active tasks</div>
      <div id="todo-archive" class="todo-archive">
        <div class="archive-controls"><button id="clear-archive">Clear archive</button></div>
        <ul id="archive-list" class="archive-list"></ul>
        <div id="archive-empty" class="todo-empty">No archived tasks</div>
      </div>
    </section>
  `;
  panel.id = 'todo-panel';
  document.body.appendChild(panel);

  // Insert a close button into the header (useful on mobile/tablet when panel is a sheet)
  try {
    const header = panel.querySelector('.todo-header');
    if (header) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'todo-close';
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Close To‑Do');
      closeBtn.innerHTML = '&times;';
      // place it as the last child of header
      header.appendChild(closeBtn);
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('open');
        updateToggleLabel();
      });
    }
  } catch (e) {
    // ignore
  }

  // Mobile toggle button (appears on small screens)
  const toggle = document.createElement('button');
  toggle.className = 'todo-toggle';
  toggle.setAttribute('aria-controls', panel.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.type = 'button';
  toggle.title = 'Show To‑Do';
  toggle.textContent = 'To‑Do';
  document.body.appendChild(toggle);

  function updateToggleLabel() {
    const open = panel.classList.contains('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'Close' : 'To‑Do';
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    updateToggleLabel();
    if (panel.classList.contains('open')) input.focus();
  });

  // Close panel when tapping outside on small screens
  document.addEventListener('click', (e) => {
    try {
      const mq = window.matchMedia('(max-width:700px)');
      if (!mq.matches) return;
      if (!panel.classList.contains('open')) return;
      if (!panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove('open');
        updateToggleLabel();
      }
    } catch (e) {}
  });

  // Keep toggle visible only on small screens and keep panel open on desktop
  // Treat tablets (<=1024px) like mobile: show floating toggle and use bottom-sheet
  const mq = window.matchMedia('(max-width:1024px)');
  function handleMqChange(ev) {
    if (ev.matches) {
      // small screen or tablet: close panel by default, show toggle
      panel.classList.remove('open');
      toggle.style.display = 'inline-flex';
      updateToggleLabel();
    } else {
      // large screen: ensure panel visible and hide toggle
      panel.classList.add('open');
      toggle.style.display = 'none';
      updateToggleLabel();
    }
  }
  // initial
  try { handleMqChange(mq); if (mq.addEventListener) mq.addEventListener('change', handleMqChange); else mq.addListener(handleMqChange); } catch (e) { }

  // Apply per-character theming based on current page filename
  (function applyThemeFromPath() {
    const file = (window.location.pathname || '').split('/').pop() || '';
    const map = {
      'frankie-stein.html': { accent: '#bee112', contrast: '#000', text: '#111', bg: 'rgba(255,255,255,0.98)' },
      'claudeen-wolf.html': { accent: '#60277a', contrast: '#fff', text: '#111', bg: 'rgba(255,255,255,0.98)' },
      'draculaura.html': { accent: '#e3176b', contrast: '#fff', text: '#111', bg: 'rgba(255,255,255,0.98)' },
      'lagoona-blue.html': { accent: '#00c6f5', contrast: '#000', text: '#111', bg: 'rgba(255,255,255,0.98)' },
      'cleo-de-nile.html': { accent: '#ffd300', contrast: '#4caaad', text: '#111', bg: 'rgba(255,255,255,0.98)' }
    };
    const p = map[file] || {};
    if (p.accent) panel.style.setProperty('--todo-accent', p.accent);
    if (p.contrast) panel.style.setProperty('--todo-accent-contrast', p.contrast);
    if (p.text) panel.style.setProperty('--todo-text', p.text);
    if (p.bg) panel.style.setProperty('--todo-bg', p.bg);
  })();

  // State helpers
  function load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : { tasks: [], archive: [] }; } catch (e) { return { tasks: [], archive: [] }; }
  }
  function save(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); window.dispatchEvent(new Event('storage')); } catch(e){} }

  let state = load();

  // Elements
  const input = qs('#todo-input', panel);
  const addBtn = qs('#todo-add-btn', panel);
  const listEl = qs('#todo-list', panel);
  const emptyEl = qs('#todo-empty', panel);
  const archiveEl = qs('#todo-archive', panel);
  const archiveList = qs('#archive-list', panel);
  const archiveEmpty = qs('#archive-empty', panel);
  const clearArchiveBtn = qs('#clear-archive', panel);
  const tabButtons = qsa('.todo-tabs button', panel);

  function makeId() { return 't_' + Math.random().toString(36).slice(2,9); }

  function render() {
    // Active
    listEl.innerHTML = '';
    const active = state.tasks.filter(t => !t.completed);
    if (active.length === 0) emptyEl.style.display = 'block'; else emptyEl.style.display = 'none';
    active.forEach(t => {
      const li = document.createElement('li');
      li.className = 'todo-item';
      li.innerHTML = `
        <label><input type="checkbox" data-id="${t.id}" class="todo-check" /> <span class="todo-text"></span></label>
        <button class="todo-delete" data-id="${t.id}" aria-label="Delete">×</button>
      `;
      li.querySelector('.todo-text').textContent = t.text;
      listEl.appendChild(li);
    });

    // Archive
    archiveList.innerHTML = '';
    const archived = state.archive || [];
    if (archived.length === 0) archiveEmpty.style.display = 'block'; else archiveEmpty.style.display = 'none';
    archived.slice().reverse().forEach(a => {
      const li = document.createElement('li');
      li.className = 'archive-item';
      const when = new Date(a.completedAt).toLocaleString();
      li.innerHTML = `<div class="archive-text">${escapeHtml(a.text)}</div><div class="archive-meta">${when}</div>`;
      archiveList.appendChild(li);
    });
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function addTask(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;
    const task = { id: makeId(), text: trimmed, completed: false, createdAt: Date.now() };
    state.tasks.push(task);
    save(state);
    render();
    input.value = '';
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(state);
    render();
  }

  function completeTask(id) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    const t = state.tasks.splice(idx,1)[0];
    t.completed = true; t.completedAt = Date.now();
    state.archive = state.archive || [];
    state.archive.push({ id: t.id, text: t.text, completedAt: t.completedAt });
    save(state);
    render();
  }

  // Events
  addBtn.addEventListener('click', () => addTask(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(input.value); });

  panel.addEventListener('click', (e) => {
    const del = e.target.closest('.todo-delete');
    if (del) { deleteTask(del.getAttribute('data-id')); return; }
    const chk = e.target.closest('.todo-check');
    if (chk) { const id = chk.getAttribute('data-id'); if (chk.checked) completeTask(id); }
  });

  clearArchiveBtn.addEventListener('click', () => {
    if (!confirm('Clear all archived tasks?')) return;
    state.archive = [];
    save(state);
    render();
  });

  tabButtons.forEach(b => b.addEventListener('click', (ev) => {
    tabButtons.forEach(x => x.classList.remove('active'));
    ev.target.classList.add('active');
    const tab = ev.target.getAttribute('data-tab');
    if (tab === 'active') { archiveEl.style.display = 'none'; listEl.style.display = 'block'; emptyEl.style.display = state.tasks.filter(t=>!t.completed).length ? 'none' : 'block'; }
    else { archiveEl.style.display = 'block'; listEl.style.display = 'none'; emptyEl.style.display = 'none'; }
  }));

  // Listen for storage (in case other pages modify tasks)
  window.addEventListener('storage', () => { state = load(); render(); });

  // initial render
  render();

  // expose for debug
  window.__pomodoro_todos = { get: () => state, add: addTask };
});
