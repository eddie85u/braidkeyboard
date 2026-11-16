/* Braid Keyboard, English home only: send a first visit from a Spanish browser to /es/.
   Never when the visitor chose a language (saved, or ?lang=en from the switcher), never for crawlers. */
(function () {
  try {
    var q = new URLSearchParams(location.search).get('lang'), saved = localStorage.getItem('braid-lang');
    if (q === 'en' || q === 'es') { localStorage.setItem('braid-lang', q); saved = q; }
    if (/bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|whatsapp/i.test(navigator.userAgent)) return;
    var want = saved || ((navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en');
    if (want === 'es') location.replace('es/' + location.hash);
  } catch (e) {}
})();
