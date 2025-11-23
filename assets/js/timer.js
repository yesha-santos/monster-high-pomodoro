document.addEventListener('DOMContentLoaded', () => {
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const modeButtons = document.querySelectorAll('.mode-buttons button');
  const controls = document.querySelectorAll('.controls button');

  // Remove any leftover debug overlay injected earlier by development edits
  try { const old = document.getElementById('timer-debug'); if (old && old.parentNode) old.parentNode.removeChild(old); } catch (e) {}

  // Simple debug passthrough — only log to console so messages appear in DevTools
  function debug(msg) {
    try { console.debug(msg); } catch (e) {}
  }

  debug({ event: 'timer.js loaded', minutesEl: !!minutesEl, secondsEl: !!secondsEl, modeButtonsCount: modeButtons.length, controlsCount: controls.length });

  // Expect controls order: [reset, toggle(pause/resume), stop]
  const resetBtn = controls[0];
  const toggleBtn = controls[1]; // single pause/resume toggle
  const stopBtn = controls[2];

  // Ensure the toggle button uses an <img> (so it's not text)
  function ensureToggleImg() {
    if (!toggleBtn) return;
    let img = toggleBtn.querySelector('img');
    if (!img) {
      // remove any existing text and inject an img element
      toggleBtn.textContent = '';
      img = document.createElement('img');
      img.className = 'timer-toggle-img';
      // put your images in assets/images/PAUSE.png and assets/images/CONTINUE.png
      // initial src will be updated by updateToggleButton when state is known
      img.src = '/assets/images/CONTINUE.png';
      img.alt = 'Continue';
      img.style.cssText = 'height:40px; width:auto; vertical-align:middle; pointer-events:none;';
      toggleBtn.appendChild(img);
      // accessibility
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.setAttribute('aria-label', 'Toggle timer');
    }
  }

  if (!minutesEl || !secondsEl) {
    debug('ERROR: Timer elements not found: #minutes or #seconds is missing');
    return;
  }

  if (modeButtons.length === 0) {
    debug('WARN: No .mode-buttons buttons found');
  }

  if (controls.length < 2) {
    debug('WARN: Expected at least 2 control buttons (reset, toggle). Found ' + controls.length);
  }

  // Create the toggle img early so updates swap the image instead of text
  ensureToggleImg();
  // hide the separate stop/pause button if present (we use a single toggle button)
  if (stopBtn) {
    try { stopBtn.style.display = 'none'; } catch (e) {}
  }

  let interval = null;
  let remainingSeconds = 0;
  const STORAGE_KEY = 'pomodoro:state';
  let activeMinutes = null;

  function updateDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    if (minutesEl) minutesEl.textContent = String(mins).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(secs).padStart(2, '0');
  }

  // Set toggle button image/text based on running state
  function updateToggleButton(isRunning) {
    if (!toggleBtn) return;
    // keep aria-pressed in sync
    toggleBtn.setAttribute('aria-pressed', isRunning ? 'true' : 'false');

    // Determine character folder. Set the folder name (e.g. "Claudeen Wolf") on the page:
    // <body data-character="Claudeen Wolf"> or any element with [data-character].
    function getCharacterFolder() {
      // 1) explicit data-character attribute on body or element
      const fromBody = document.body && document.body.getAttribute && document.body.getAttribute('data-character');
      if (fromBody) return fromBody;
      const el = document.querySelector('[data-character]');
      if (el) return el.getAttribute('data-character');
      // 2) map filename -> folder name (common pages/characters/* filenames)
      const file = (window.location.pathname || '').split('/').pop() || '';
      const map = {
        'frankie-stein.html': 'FrankieStein',
        'claudeen-wolf.html': 'ClaudeenWolf',
        'draculaura.html': 'Draculaura',
        'lagoona-blue.html': 'LagoonaBlue',
        'cleo-de-nile.html': 'CleoDeNile'
      };
      if (map[file]) return map[file];
      // fallback: empty => use root images folder
      return '';
    }

    const folder = getCharacterFolder();
    const basePath = '/assets/images';
    const folderPath = folder ? `${basePath}/${encodeURIComponent(folder)}` : basePath;
    const pauseSrc = `${folderPath}/CONTINUE.png`;
    const continueSrc = `${folderPath}/PAUSE.png`;

    const img = toggleBtn.querySelector('img');
    if (img) {
      // Use character-specific images if available (URLs are encoded for spaces)
      img.src = isRunning ? pauseSrc : continueSrc;
      img.alt = isRunning ? 'Pause' : 'Continue';
    } else {
      // fallback to text if image is missing
      toggleBtn.textContent = isRunning ? 'Pause' : 'Continue';
    }
  }

  function pauseTimer() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    saveState({ isRunning: false });
    updateToggleButton(false);
  }

  function startTimer() {
    if (!minutesEl || !secondsEl) return;
    if (interval) return; // already running
    interval = setInterval(() => {
      if (remainingSeconds <= 0) {
        pauseTimer();
        remainingSeconds = 0;
        updateDisplay();
        saveState({ isRunning: false });
        return;
      }
      remainingSeconds -= 1;
      updateDisplay();
      saveState({ isRunning: true });
    }, 1000);
    debug('Timer started, remainingSeconds=' + remainingSeconds);
    saveState({ isRunning: true });
    updateToggleButton(true);
  }

  function resetTimer() {
    const active = document.querySelector('.mode-buttons button.active') || modeButtons[0];
    const minutes = parseInt(active?.getAttribute('data-time') || '25', 10);
    remainingSeconds = minutes * 60;
    updateDisplay();
    pauseTimer();
    activeMinutes = minutes;
    saveState({ isRunning: false, remainingSeconds, activeMinutes });
    updateToggleButton(false);
  }

  function saveState(override = {}) {
    try {
      const state = loadRawState() || {};
      const now = Date.now();
      const payload = {
        remainingSeconds: typeof remainingSeconds === 'number' ? Math.max(0, Math.floor(remainingSeconds)) : state.remainingSeconds || 0,
        isRunning: typeof override.isRunning === 'boolean' ? override.isRunning : !!state.isRunning,
        lastUpdated: now,
        activeMinutes: typeof override.activeMinutes === 'number' ? override.activeMinutes : (activeMinutes || state.activeMinutes || (modeButtons[0] && parseInt(modeButtons[0].getAttribute('data-time'))))
      };
      if (typeof override.remainingSeconds === 'number') payload.remainingSeconds = override.remainingSeconds;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Could not save timer state', e);
    }
  }

  function loadRawState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function restoreState() {
    const state = loadRawState();
    if (!state) return false;
    const now = Date.now();
    let rs = typeof state.remainingSeconds === 'number' ? state.remainingSeconds : 0;
    activeMinutes = state.activeMinutes || activeMinutes;
    if (state.isRunning) {
      const elapsed = Math.floor((now - (state.lastUpdated || now)) / 1000);
      rs = rs - elapsed;
      if (rs <= 0) {
        remainingSeconds = 0;
        updateDisplay();
        pauseTimer();
        saveState({ isRunning: false });
        return true;
      }
      remainingSeconds = rs;
      updateDisplay();
      startTimer();
    } else {
      remainingSeconds = rs;
      updateDisplay();
      updateToggleButton(false);
    }

    if (activeMinutes && modeButtons.length) {
      modeButtons.forEach(b => {
        if (parseInt(b.getAttribute('data-time'), 10) === Number(activeMinutes)) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    }
    return true;
  }

  // Initialize mode buttons
  modeButtons.forEach(button => {
    button.addEventListener('click', () => {
      debug('mode button clicked ' + button.getAttribute('data-time'));
      modeButtons.forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      const minutes = parseInt(button.getAttribute('data-time') || '25', 10);
      remainingSeconds = minutes * 60;
      activeMinutes = minutes;
      updateDisplay();
      pauseTimer();
      saveState({ isRunning: false, activeMinutes: minutes, remainingSeconds });
      updateToggleButton(false);
    });
  });

  // Wire control buttons
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      debug('toggle clicked');
      if (interval) {
        pauseTimer();
      } else {
        // If there's no remainingSeconds set (e.g. first start), initialize from active mode
        if (!remainingSeconds || remainingSeconds <= 0) {
          const active = document.querySelector('.mode-buttons button.active') || modeButtons[0];
          const minutes = parseInt(active?.getAttribute('data-time') || '25', 10);
          remainingSeconds = minutes * 60;
          activeMinutes = minutes;
          updateDisplay();
          saveState({ remainingSeconds, activeMinutes });
        }
        startTimer();
      }
    });
  }
  if (stopBtn) stopBtn.addEventListener('click', () => { debug('stop clicked'); pauseTimer(); updateToggleButton(false); });
  if (resetBtn) resetBtn.addEventListener('click', () => { debug('reset clicked'); resetTimer(); });

  const restored = restoreState();
  if (!restored) {
    resetTimer();
    saveState({ isRunning: false });
  } else {
    // make sure toggle img exists and matches running state
    ensureToggleImg();
    updateToggleButton(!!interval);
  }

  // Sync with other tabs
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    const newState = loadRawState();
    if (!newState) return;
    debug('storage event received — syncing timer');
    const now = Date.now();
    let rs = typeof newState.remainingSeconds === 'number' ? newState.remainingSeconds : 0;
    if (newState.isRunning) {
      const elapsed = Math.floor((now - (newState.lastUpdated || now)) / 1000);
      rs = rs - elapsed;
      if (rs <= 0) rs = 0;
    }
    remainingSeconds = Math.max(0, Math.floor(rs));
    updateDisplay();
    activeMinutes = newState.activeMinutes || activeMinutes;
    if (activeMinutes && modeButtons.length) {
      modeButtons.forEach(b => {
        if (parseInt(b.getAttribute('data-time'), 10) === Number(activeMinutes)) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
    }
    if (newState.isRunning) {
      pauseTimer();
      startTimer();
    } else {
      pauseTimer();
    }
    updateToggleButton(!!newState.isRunning);
  });

  window.addEventListener('beforeunload', () => {
    saveState({ isRunning: !!interval });
  });
});
