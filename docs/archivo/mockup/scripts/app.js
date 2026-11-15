/**
 * ILARA BEAUTY - GLOBAL APP CONTROLLER (app.js)
 * Theme toggle, keyboard shortcuts, device previews, and system utilities.
 */

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('ilara-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ilara-theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const btnIcons = document.querySelectorAll('.theme-toggle-btn-icon');
  btnIcons.forEach(icon => {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});
