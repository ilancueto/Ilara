/* Fuerza clase .dark antes del primer paint (sin inline script → CSP más estricta). */
(function () {
  try {
    var key = 'ilara-theme';
    var stored = localStorage.getItem(key);
    var dark = stored === 'dark';
    document.documentElement.classList.toggle('dark', dark);
  } catch {
    /* localStorage puede fallar en modo privado estricto */
  }
})();
