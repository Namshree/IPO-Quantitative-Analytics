// Light/dark theme toggle. Persists the user's explicit choice in
// localStorage under 'ipo-theme'. When nothing is stored, the page follows
// the OS-level prefers-color-scheme automatically (handled purely in CSS).
(function () {
  var STORAGE_KEY = 'ipo-theme';
  var root = document.documentElement;

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function currentTheme() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  }

  function applyIcon(theme) {
    var icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    icon.innerHTML = theme === 'dark' ? '&#9788;' : '&#9789;'; // sun : moon
  }

  function setTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    applyIcon(theme);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }
  }

  function init() {
    setTheme(currentTheme(), false);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        setTheme(next, true);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
