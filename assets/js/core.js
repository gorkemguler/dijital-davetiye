/*!
 * Dijital Davetiye — çekirdek (editör ve davetiye sayfasının ortak kullandığı kod)
 * MIT Lisansı
 *
 * Not: Bu dosya "tek dosya HTML" dışa aktarımında <script> içine gömülür.
 * Bu yüzden kod içinde kapanış script etiketi metni geçmemelidir.
 */
(function (global) {
  'use strict';

  var DV = (global.DV = global.DV || {});
  DV.VERSION = '1.0.0';
  DV.SCHEMA = 1;
  DV.REPO_URL = 'https://github.com/';

  /* ------------------------------------------------------------------ *
   *  Genel yardımcılar
   * ------------------------------------------------------------------ */

  DV.uid = function (prefix) {
    return (prefix || '') + Math.random().toString(36).slice(2, 9);
  };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  DV.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  };

  /** Metni kaçışlar, satır sonlarını <br> yapar. */
  DV.text = function (s) {
    return DV.esc(s).replace(/\r?\n/g, '<br>');
  };

  DV.clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  DV.isObj = function (o) { return o !== null && typeof o === 'object' && !Array.isArray(o); };

  DV.get = function (obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  };

  DV.set = function (obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  };

  DV.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  var TR_MAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'i̇': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
  DV.slugify = function (s) {
    return String(s || '')
      .toLocaleLowerCase('tr')
      .replace(/[çğıöşüâîû]|i̇/g, function (c) { return TR_MAP[c] || c; })
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  };

  DV.isDataUrl = function (u) { return /^data:/i.test(String(u || '')); };

  /**
   * Kullanıcı verisinden gelen bağlantıları güvenli hale getirir.
   * kind: 'link' (http/https/mailto/tel), 'image', 'audio'
   * Göreli yollar (ör. invitations/img/kapak.jpg) kabul edilir.
   */
  DV.safeUrl = function (url, kind) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^data:/i.test(u)) {
      if (kind === 'image' && /^data:image\/(png|jpe?g|webp|gif|avif);/i.test(u)) return u;
      if (kind === 'audio' && /^data:audio\/[a-z0-9.+-]+;/i.test(u)) return u;
      return '';
    }
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (kind === 'link' && /^(mailto:|tel:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, vbscript: vb.
    return u; // göreli yol
  };

  DV.hexToRgb = function (hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  DV.luminance = function (hex) {
    var c = DV.hexToRgb(hex);
    if (!c) return 1;
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };

  /** Verilen zemin rengi üzerinde okunaklı yazı rengi. */
  DV.readableOn = function (hex) {
    return DV.luminance(hex) > 0.42 ? '#1d1a17' : '#ffffff';
  };

  var loaded = {};
  DV.loadScript = function (src) {
    if (!loaded[src]) {
      loaded[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = function () { delete loaded[src]; reject(new Error('Yüklenemedi: ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  };
  DV.loadCss = function (href) {
    if (!loaded[href]) {
      loaded[href] = new Promise(function (resolve) {
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = href;
        l.onload = resolve; l.onerror = resolve;
        document.head.appendChild(l);
      });
    }
    return loaded[href];
  };

  DV.LIBS = {
    leafletJs: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    leafletCss: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
    qrcode: 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
  };

  DV.loadLeaflet = function () {
    return Promise.all([DV.loadCss(DV.LIBS.leafletCss), DV.loadScript(DV.LIBS.leafletJs)]).then(function () { return global.L; });
  };

  /**
   * Harita karo katmanı — OpenStreetMap (API anahtarı gerektirmez).
   * Koyu şablonlarda karolar CSS filtresiyle koyulaştırılır (.dv-map-dark).
   * Yoğun trafik bekleniyorsa kendi karo sağlayıcınızı buraya yazabilirsiniz.
   */
  DV.tileLayer = function (L) {
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    });
  };

  /* ------------------------------------------------------------------ *
   *  Yazı tipleri (hepsi Türkçe karakter destekli — latin-ext)
   * ------------------------------------------------------------------ */

  DV.fonts = [
    // El yazısı
    { name: 'Great Vibes', cat: 'script' },
    { name: 'Allura', cat: 'script' },
    { name: 'Alex Brush', cat: 'script' },
    { name: 'Parisienne', cat: 'script' },
    { name: 'Pinyon Script', cat: 'script' },
    { name: 'Sacramento', cat: 'script' },
    { name: 'Italianno', cat: 'script' },
    { name: 'Petit Formal Script', cat: 'script' },
    { name: 'Mrs Saint Delafield', cat: 'script' },
    { name: 'WindSong', cat: 'script' },
    { name: 'Ephesis', cat: 'script' },
    { name: 'Imperial Script', cat: 'script' },
    { name: 'Corinthia', cat: 'script' },
    { name: 'Birthstone', cat: 'script' },
    { name: 'Monsieur La Doulaise', cat: 'script' },
    { name: 'Dancing Script', cat: 'script', spec: 'wght@400;600' },
    { name: 'Caveat', cat: 'script', spec: 'wght@400;600' },
    // Serif / başlık
    { name: 'Cormorant Garamond', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'Cormorant', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'Playfair Display', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'Bodoni Moda', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'EB Garamond', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'Lora', cat: 'serif', spec: 'ital,wght@0,400;0,500;0,600;1,400' },
    { name: 'Libre Baskerville', cat: 'serif', spec: 'ital,wght@0,400;0,700;1,400' },
    { name: 'Fraunces', cat: 'serif', spec: 'ital,wght@0,300;0,400;0,500;0,600;1,400' },
    { name: 'DM Serif Display', cat: 'serif', spec: 'ital@0;1' },
    { name: 'Cinzel', cat: 'serif', spec: 'wght@400;500;600' },
    { name: 'Cinzel Decorative', cat: 'serif', spec: 'wght@400;700' },
    { name: 'Marcellus', cat: 'serif' },
    { name: 'Gilda Display', cat: 'serif' },
    { name: 'Forum', cat: 'serif' },
    { name: 'Yeseva One', cat: 'serif' },
    { name: 'Poiret One', cat: 'serif' },
    { name: 'Limelight', cat: 'serif' },
    { name: 'Amatic SC', cat: 'serif', spec: 'wght@400;700' },
    // Sans / gövde
    { name: 'Montserrat', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Lato', cat: 'sans', spec: 'wght@300;400;700' },
    { name: 'Raleway', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Josefin Sans', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Jost', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Quicksand', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Nunito', cat: 'sans', spec: 'wght@300;400;600' },
    { name: 'Poppins', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Mulish', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Outfit', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Karla', cat: 'sans', spec: 'wght@300;400;500;600' },
    { name: 'Work Sans', cat: 'sans', spec: 'wght@300;400;500;600' }
  ];

  DV.font = function (name) {
    for (var i = 0; i < DV.fonts.length; i++) if (DV.fonts[i].name === name) return DV.fonts[i];
    return null;
  };

  DV.fontHref = function (name) {
    var f = DV.font(name);
    if (!f) return '';
    return 'https://fonts.googleapis.com/css2?family=' + f.name.replace(/ /g, '+') + (f.spec ? ':' + f.spec : '') + '&display=swap';
  };

  var FALLBACK = { script: "'Brush Script MT', cursive", serif: "Georgia, 'Times New Roman', serif", sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" };
  DV.fontStack = function (name, cat) {
    var f = DV.font(name);
    var c = (f && f.cat) || cat || 'serif';
    return (name ? "'" + String(name).replace(/'/g, '') + "', " : '') + FALLBACK[c];
  };

  /** Her yazı tipini ayrı <link> ile yükler (biri hatalı olsa diğerleri etkilenmez). */
  DV.loadFonts = function (names, doc) {
    doc = doc || document;
    (names || []).forEach(function (n) {
      if (!n) return;
      var href = DV.fontHref(n);
      if (!href || doc.querySelector('link[data-font="' + n + '"]')) return;
      var l = doc.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.setAttribute('data-font', n);
      doc.head.appendChild(l);
    });
  };

  /* ------------------------------------------------------------------ *
   *  İkonlar (24x24, çizgi tabanlı)
   * ------------------------------------------------------------------ */

  DV.ICONS = {
    rings: '<circle cx="9" cy="14.5" r="5.5"/><circle cx="15" cy="14.5" r="5.5"/><path d="M13 5.7l1.4-2h2.2l1.4 2-2.5 2.6z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    henna: '<path d="M4.5 14.5h15l-2.2 5.5H6.7z"/><path d="M8.5 14.5V11M15.5 14.5V11M12 14.5V9.5"/><path d="M12 3.5c1.4 1.7 1.4 3 0 4-1.4-1-1.4-2.3 0-4zM8.5 6.3c1 1.2 1 2.2 0 2.9-1-.7-1-1.7 0-2.9zM15.5 6.3c1 1.2 1 2.2 0 2.9-1-.7-1-1.7 0-2.9z"/>',
    sparkle: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    razor: '<circle cx="6.5" cy="17.5" r="2.7"/><circle cx="17.5" cy="17.5" r="2.7"/><path d="M8.4 15.6L17 3.5M15.6 15.6L7 3.5"/>',
    car: '<path d="M3 13.5l2.1-5A2 2 0 0 1 7 7h10a2 2 0 0 1 1.9 1.5l2.1 5V17H3z"/><circle cx="7.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/><path d="M3 13.5h18"/><path d="M10 4.5l2 1.5 2-1.5M12 6V7"/>',
    pen: '<path d="M5 19l1-4.2L16.3 4.5a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L9.2 18z"/><path d="M14.5 6.3l3.2 3.2"/><path d="M4 21h16"/>',
    book: '<path d="M12 6.2C10 4.8 7 4.3 4 4.8v14c3-.5 6 0 8 1.4 2-1.4 5-1.9 8-1.4v-14c-3-.5-6 0-8 1.4z"/><path d="M12 6.2v14"/>',
    glass: '<path d="M5 4h14l-7 8.2z"/><path d="M12 12.2V20M8 20.5h8"/><path d="M8.5 7.5h7"/>',
    dinner: '<circle cx="12" cy="12.5" r="5"/><path d="M3.5 3.5v5c0 1 .7 2 1.5 2s1.5-1 1.5-2v-5M5 10.5V21M20.5 3.5c-1.3.8-2.1 2.6-2.1 5s.8 3 2.1 3V21"/>',
    music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z"/>',
    coffee: '<path d="M4 9.5h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    cake: '<path d="M4 21V13.5a1.5 1.5 0 0 1 1.5-1.5h13a1.5 1.5 0 0 1 1.5 1.5V21"/><path d="M4 16.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0"/><path d="M3 21h18M8 12V9M12 12V9M16 12V9"/><path d="M12 4c.9 1.1.9 2 0 2.6-.9-.6-.9-1.5 0-2.6z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    nav: '<path d="M3.5 11L20.5 3.5 13 20.5l-2-7.5z"/>',
    map: '<path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
    phone: '<path d="M5.5 4h3.3l1.7 4.3-2.2 1.4a10.5 10.5 0 0 0 6 6l1.4-2.2 4.3 1.7v3.3a1.8 1.8 0 0 1-1.8 1.8A15.8 15.8 0 0 1 3.7 5.8 1.8 1.8 0 0 1 5.5 4z"/>',
    chat: '<path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.6 18.7z"/><path d="M9 10.5c.3 1.6 1.9 3.3 3.6 3.8l1-1 1.6.6"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5"/><path d="M12 8S10.6 3.6 8.2 4.5C6.5 5.2 8 8 12 8zM12 8s1.4-4.4 3.8-3.5C17.5 5.2 16 8 12 8z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bus: '<rect x="4.5" y="3.5" width="15" height="14.5" rx="3"/><path d="M4.5 11h15M7.5 18v2.5M16.5 18v2.5M8.5 6.5h7"/><circle cx="8" cy="14.5" r=".9"/><circle cx="16" cy="14.5" r=".9"/>',
    bed: '<path d="M3 18.5V6M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="10.8" r="2"/>',
    parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5"/>',
    shirt: '<path d="M8.5 3.5L12 6l3.5-2.5 5 3-2 4.8-2.5-1V20.5h-8V10.3l-2.5 1-2-4.8z"/>',
    child: '<circle cx="12" cy="5.5" r="2.5"/><path d="M7 10.5l5-1.5 5 1.5M12 9v6M9 21l3-6 3 6"/>',
    camera: '<path d="M4 8.5h3l1.8-2.8h6.4L17 8.5h3V19H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
    hotel: '<path d="M4 20.5V4.5h11v16M15 9.5h5v11M2.5 20.5h19"/><path d="M7.5 8h1.5M10.5 8H12M7.5 11.5h1.5M10.5 11.5H12M7.5 15h1.5M10.5 15H12"/>',
    plane: '<path d="M10.2 13.8L3.5 11.5l1.4-1.4 7.3.7 4.6-4.6a1.8 1.8 0 0 1 2.5 2.5l-4.6 4.6.7 7.3-1.4 1.4-2.3-6.7-3 3 .2 2-1 1-1.4-2.6-2.6-1.4 1-1 2 .2z"/>',
    flower: '<circle cx="12" cy="10" r="2.2"/><path d="M12 7.8c-1.6-3.6 2.6-4.8 2.6-1.4M14.1 9.1c3.6-1.3 4.2 3 .9 2.6M13.2 12c1.9 3.4-2.3 4.3-2.4.9M10.4 11.6c-3.6 1-3.8-3.3-.5-2.6M10 8.3C7.3 5.9 10.4 3 12 7.8"/><path d="M12 12.2V21M12 17c-2.5-2.5-5-1.5-5-1.5s1 3 5 2M12 18c2.5-2.5 5-1.5 5-1.5s-1 3-5 2"/>',
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 13.7a6 6 0 0 1 3.3 5.8"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    arrowDown: '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17.5" cy="6" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="M8.3 10.8l7-3.6M8.3 13.2l7 3.6"/>'
  };

  DV.icon = function (name, cls) {
    var p = DV.ICONS[name] || DV.ICONS.star;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>';
  };

  /** Bilgi kartlarında seçilebilecek ikonlar */
  DV.INFO_ICONS = ['info', 'bus', 'parking', 'hotel', 'bed', 'plane', 'shirt', 'child', 'camera', 'gift', 'clock', 'pin', 'phone', 'heart', 'glass', 'music', 'dinner', 'cake', 'flower', 'star', 'users'];

  /* ------------------------------------------------------------------ *
   *  Etkinlik türleri — Türk düğün geleneklerine göre
   * ------------------------------------------------------------------ */

  DV.EVENT_TYPES = [
    { id: 'soz', icon: 'rings', tr: 'Söz Merasimi', en: 'Promise Ceremony', dur: 3 },
    { id: 'nisan', icon: 'rings', tr: 'Nişan Töreni', en: 'Engagement Party', dur: 4 },
    { id: 'kina', icon: 'henna', tr: 'Kına Gecesi', en: 'Henna Night', dur: 4 },
    { id: 'bekarliga', icon: 'sparkle', tr: 'Bekarlığa Veda', en: 'Bachelor(ette) Party', dur: 4 },
    { id: 'tiras', icon: 'razor', tr: 'Damat Tıraşı', en: "Groom's Shave", dur: 2 },
    { id: 'gelinalma', icon: 'car', tr: 'Gelin Alma', en: 'Bride Pick-up', dur: 2 },
    { id: 'nikah', icon: 'pen', tr: 'Nikah Töreni', en: 'Civil Ceremony', dur: 1 },
    { id: 'dininikah', icon: 'book', tr: 'Dini Nikah', en: 'Religious Ceremony', dur: 1 },
    { id: 'dugun', icon: 'heart', tr: 'Düğün', en: 'Wedding Celebration', dur: 5 },
    { id: 'kokteyl', icon: 'glass', tr: 'Kokteyl', en: 'Cocktail Reception', dur: 2 },
    { id: 'yemek', icon: 'dinner', tr: 'Düğün Yemeği', en: 'Wedding Dinner', dur: 3 },
    { id: 'after', icon: 'music', tr: 'After Party', en: 'After Party', dur: 4 },
    { id: 'mevlit', icon: 'moon', tr: 'Mevlit', en: 'Mawlid', dur: 2 },
    { id: 'brunch', icon: 'coffee', tr: 'Ertesi Gün Kahvaltısı', en: 'Farewell Brunch', dur: 3 },
    { id: 'ozel', icon: 'star', tr: 'Özel Etkinlik', en: 'Event', dur: 3 }
  ];

  DV.eventType = function (id) {
    for (var i = 0; i < DV.EVENT_TYPES.length; i++) if (DV.EVENT_TYPES[i].id === id) return DV.EVENT_TYPES[i];
    return DV.EVENT_TYPES[DV.EVENT_TYPES.length - 1];
  };

  DV.eventName = function (ev, lang) {
    if (ev.title) return ev.title;
    var t = DV.eventType(ev.type);
    return t[lang] || t.tr;
  };

  /* ------------------------------------------------------------------ *
   *  Veri modeli
   * ------------------------------------------------------------------ */

  DV.SECTIONS = [
    { id: 'intro', label: 'Davet metni & aileler' },
    { id: 'countdown', label: 'Geri sayım' },
    { id: 'events', label: 'Etkinlik programı' },
    { id: 'story', label: 'Hikayemiz' },
    { id: 'gallery', label: 'Fotoğraf galerisi' },
    { id: 'info', label: 'Bilmeniz gerekenler' },
    { id: 'rsvp', label: 'LCV (katılım bildirimi)' },
    { id: 'gift', label: 'Hediye / IBAN' },
    { id: 'contacts', label: 'İletişim' },
    { id: 'closing', label: 'Kapanış' }
  ];

  DV.defaultSections = function () {
    return DV.SECTIONS.map(function (s) { return { id: s.id, on: true }; });
  };

  DV.newEvent = function (type) {
    return {
      id: DV.uid('e'),
      type: type || 'dugun',
      title: '',
      date: '',
      start: '',
      end: '',
      venue: '',
      address: '',
      city: '',
      lat: null,
      lng: null,
      host: '',      // '' ortak | 'bride' kız tarafı | 'groom' erkek tarafı
      dress: '',
      note: '',
      main: false,
      groups: [],    // boş = herkes görür
      hidden: false
    };
  };

  DV.defaults = function () {
    return {
      v: DV.SCHEMA,
      lang: 'tr',
      timezone: 'Europe/Istanbul',
      couple: {
        bride: { name: '', surname: '', parents: '' },
        groom: { name: '', surname: '', parents: '' },
        order: 'bride',
        photo: '',
        photoPos: 'center',
        hashtag: ''
      },
      texts: {
        kicker: '',
        greeting: '',
        intro: '',
        quote: '',
        quoteAuthor: '',
        familyLine: '',
        closing: '',
        signature: ''
      },
      events: [],
      story: [],
      gallery: [],
      info: [],
      rsvp: {
        method: 'whatsapp',  // whatsapp | email | sheets | formspree | link | none
        whatsapp: '',
        email: '',
        endpoint: '',
        formUrl: '',
        deadline: '',
        askCount: true,
        maxCount: 10,
        askEvents: true,
        text: ''
      },
      contacts: [],
      gift: { text: '', accounts: [] },
      music: { url: '', title: '', autoplay: true },
      design: {
        template: 'klasik-altin',
        hero: '',
        eventsLayout: '',
        colors: { bg: '', text: '', primary: '', accent: '' },
        fonts: { script: '', heading: '', body: '' },
        envelope: true,
        effect: 'auto',
        groupByCity: true,
        photoFilter: '',
        credit: true,
        sections: DV.defaultSections()
      },
      // Yalnızca editörde tutulur; davetiyeye ASLA yazılmaz
      guests: { groups: [], list: [], message: '' },
      publish: { baseUrl: '', slug: '', mode: 'link', customUrl: '' }
    };
  };

  function mergeDefaults(def, src) {
    if (!DV.isObj(src)) return def;
    var out = {};
    Object.keys(def).forEach(function (k) {
      var d = def[k], s = src[k];
      if (s === undefined || (s === null && d !== null)) out[k] = d;
      else if (Array.isArray(d)) out[k] = Array.isArray(s) ? s : d;
      else if (DV.isObj(d)) out[k] = mergeDefaults(d, s);
      else if (d === null || typeof d === typeof s) out[k] = s;
      else if (typeof d === 'string' && typeof s === 'number') out[k] = String(s);
      else out[k] = d;
    });
    return out;
  }

  function arr(a) { return Array.isArray(a) ? a.filter(function (x) { return x != null; }) : []; }

  function num(v) {
    if (v === '' || v == null) return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  /** Eksik/eski veriyi güncel şemaya tamamlar. */
  DV.normalize = function (raw) {
    var src = DV.isObj(raw) ? raw : {};
    var out = mergeDefaults(DV.defaults(), src);

    out.events = arr(src.events).map(function (e) {
      var ev = mergeDefaults(DV.newEvent(e && e.type), e);
      ev.lat = num(ev.lat); ev.lng = num(ev.lng);
      ev.groups = arr(ev.groups).map(String);
      if (!ev.id) ev.id = DV.uid('e');
      return ev;
    });
    out.story = arr(src.story).map(function (x) { return mergeDefaults({ date: '', title: '', text: '' }, x); });
    out.gallery = arr(src.gallery).map(function (x) {
      return typeof x === 'string' ? { src: x, caption: '' } : mergeDefaults({ src: '', caption: '' }, x);
    }).filter(function (g) { return g.src; });
    out.info = arr(src.info).map(function (x) { return mergeDefaults({ icon: 'info', title: '', text: '', link: '', linkText: '' }, x); });
    out.contacts = arr(src.contacts).map(function (x) { return mergeDefaults({ name: '', role: '', phone: '' }, x); });
    out.gift.accounts = arr(src.gift && src.gift.accounts).map(function (x) { return mergeDefaults({ bank: '', holder: '', iban: '' }, x); });
    out.guests.groups = arr(src.guests && src.guests.groups).map(function (x) { return mergeDefaults({ id: '', name: '' }, x); }).filter(function (g) { return g.id; });
    out.guests.list = arr(src.guests && src.guests.list).map(function (x) { return mergeDefaults({ id: DV.uid('g'), name: '', group: '', phone: '', note: '' }, x); });

    var known = DV.SECTIONS.map(function (s) { return s.id; });
    var given = arr(src.design && src.design.sections).filter(function (s) { return s && known.indexOf(s.id) >= 0; });
    var seen = {};
    var secs = [];
    given.forEach(function (s) { if (!seen[s.id]) { seen[s.id] = 1; secs.push({ id: s.id, on: s.on !== false }); } });
    DV.defaultSections().forEach(function (s) { if (!seen[s.id]) secs.push(s); });
    out.design.sections = secs;
    out.rsvp.maxCount = Math.max(1, Math.min(50, parseInt(out.rsvp.maxCount, 10) || 10));
    if (out.lang !== 'en') out.lang = 'tr';
    return out;
  };

  /** Editöre özel alanları atar — davetiyeye gidecek veri. */
  DV.inviteData = function (project) {
    var d = DV.clone(project);
    delete d.guests;
    delete d.publish;
    return d;
  };

  function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function diff(obj, def) {
    var out = {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k], d = def ? def[k] : undefined;
      if (d !== undefined && deepEqual(v, d)) return;
      if (DV.isObj(v) && DV.isObj(d)) {
        var sub = diff(v, d);
        if (Object.keys(sub).length) out[k] = sub;
      } else if (Array.isArray(v)) {
        if (v.length) out[k] = v.map(function (it) { return DV.isObj(it) ? compact(it) : it; });
      } else if (v !== '' && v !== null && v !== undefined) {
        out[k] = v;
      } else if (d !== undefined && d !== '' && d !== null) {
        out[k] = v; // varsayılandan farklı boş değer (ör. kullanıcı silmiş)
      }
    });
    return out;
  }

  function compact(o) {
    var out = {};
    Object.keys(o).forEach(function (k) {
      var v = o[k];
      if (v === '' || v === null || v === undefined || v === false) return;
      if (Array.isArray(v) && !v.length) return;
      out[k] = v;
    });
    return out;
  }

  /**
   * Paylaşım bağlantısı için küçültülmüş veri.
   * Cihazdan yüklenmiş (data:) görsel/müzik bağlantıya sığmayacağından çıkarılır.
   */
  DV.shareData = function (project) {
    var d = DV.inviteData(DV.normalize(project));
    var stripped = [];
    if (DV.isDataUrl(d.couple.photo)) { d.couple.photo = ''; stripped.push('Kapak fotoğrafı'); }
    var g0 = d.gallery.length;
    d.gallery = d.gallery.filter(function (g) { return !DV.isDataUrl(g.src); });
    if (d.gallery.length < g0) stripped.push((g0 - d.gallery.length) + ' galeri fotoğrafı');
    if (DV.isDataUrl(d.music.url)) { d.music.url = ''; stripped.push('Müzik dosyası'); }

    var events = d.events.map(function (e) {
      var x = compact(diff(e, DV.newEvent(e.type)));
      delete x.id;
      x.type = e.type;
      if (e.main) x.main = true;
      return x;
    });
    delete d.events;
    var out = diff(d, DV.inviteData(DV.defaults()));
    out.v = DV.SCHEMA;
    if (events.length) out.events = events;
    return { data: out, stripped: stripped };
  };

  /* ------------------------------------------------------------------ *
   *  Bağlantı kodlama (deflate + base64url) — veri URL'nin # kısmında
   * ------------------------------------------------------------------ */

  var b64u = {
    enc: function (bytes) {
      var s = '';
      for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec: function (str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      var bin = atob(str);
      var u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
  };

  DV.codec = {
    encode: function (obj) {
      var bytes = new TextEncoder().encode(JSON.stringify(obj));
      if (typeof CompressionStream === 'function') {
        try {
          var cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
          return new Response(cs).arrayBuffer().then(function (buf) {
            return 'z.' + b64u.enc(new Uint8Array(buf));
          });
        } catch (e) { /* düz kodlamaya düş */ }
      }
      return Promise.resolve('j.' + b64u.enc(bytes));
    },
    decode: function (str) {
      return Promise.resolve().then(function () {
        str = String(str || '').trim().replace(/^#/, '').replace(/^data=/, '');
        try { str = decodeURIComponent(str); } catch (e) { /* zaten çözülmüş */ }
        var kind = str.slice(0, 2), payload = str.slice(2);
        if (kind === 'z.') {
          var ds = new Blob([b64u.dec(payload)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Response(ds).text().then(JSON.parse);
        }
        if (kind === 'j.') return JSON.parse(new TextDecoder().decode(b64u.dec(payload)));
        throw new Error('Geçersiz davetiye bağlantısı');
      });
    }
  };

  /* ------------------------------------------------------------------ *
   *  Tarih & saat (saat dilimi destekli, kütüphanesiz)
   * ------------------------------------------------------------------ */

  DV.TIMEZONES = [
    'Europe/Istanbul', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Paris', 'Europe/Vienna',
    'Europe/Zurich', 'Europe/London', 'Europe/Stockholm', 'Europe/Athens', 'Asia/Nicosia', 'Asia/Baku',
    'Asia/Dubai', 'Asia/Almaty', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto',
    'Australia/Sydney', 'UTC'
  ];

  var dt = (DV.dt = {});

  dt.parseDate = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  };
  dt.parseTime = function (s) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(s || ''));
    return m ? { h: Math.min(23, +m[1]), mi: Math.min(59, +m[2]) } : null;
  };

  dt.tzOffset = function (ts, tz) {
    try {
      var f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var p = {};
      f.formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
      var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      return asUtc - Math.floor(ts / 1000) * 1000;
    } catch (e) {
      return 3 * 3600 * 1000; // Türkiye (UTC+3)
    }
  };

  /** "2027-06-12" + "19:30" (verilen saat diliminde) → Date (UTC) */
  dt.toUtc = function (dateStr, timeStr, tz) {
    var d = dt.parseDate(dateStr);
    if (!d) return null;
    var t = dt.parseTime(timeStr) || { h: 0, mi: 0 };
    var guess = Date.UTC(d.y, d.m - 1, d.d, t.h, t.mi);
    var off = dt.tzOffset(guess, tz || 'Europe/Istanbul');
    var utc = guess - off;
    var off2 = dt.tzOffset(utc, tz || 'Europe/Istanbul');
    if (off2 !== off) utc = guess - off2;
    return new Date(utc);
  };

  dt.locale = function (lang) { return lang === 'en' ? 'en-US' : 'tr-TR'; };

  function wall(dateStr, timeStr) {
    var d = dt.parseDate(dateStr);
    if (!d) return null;
    var t = dt.parseTime(timeStr) || { h: 12, mi: 0 };
    return new Date(Date.UTC(d.y, d.m - 1, d.d, t.h, t.mi));
  }

  dt.parts = function (lang, dateStr) {
    var w = wall(dateStr);
    if (!w) return null;
    var loc = dt.locale(lang);
    var f = function (o) { o.timeZone = 'UTC'; return new Intl.DateTimeFormat(loc, o).format(w); };
    return {
      day: f({ day: 'numeric' }),
      month: f({ month: 'long' }),
      monthShort: f({ month: 'short' }),
      year: f({ year: 'numeric' }),
      weekday: f({ weekday: 'long' }),
      numeric: f({ day: '2-digit', month: '2-digit', year: 'numeric' })
    };
  };

  dt.formatDate = function (lang, dateStr, withWeekday) {
    var w = wall(dateStr);
    if (!w) return '';
    var o = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    if (withWeekday !== false) o.weekday = 'long';
    return new Intl.DateTimeFormat(dt.locale(lang), o).format(w);
  };

  dt.formatTime = function (lang, timeStr) {
    var t = dt.parseTime(timeStr);
    if (!t) return '';
    if (lang !== 'en') return (t.h < 10 ? '0' : '') + t.h + ':' + (t.mi < 10 ? '0' : '') + t.mi;
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2000, 0, 1, t.h, t.mi)));
  };

  dt.stamp = function (date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  dt.dateStamp = function (dateStr) { return String(dateStr).replace(/-/g, ''); };

  dt.addDays = function (dateStr, n) {
    var d = dt.parseDate(dateStr);
    if (!d) return '';
    var x = new Date(Date.UTC(d.y, d.m - 1, d.d + n));
    return x.toISOString().slice(0, 10);
  };

  /* ------------------------------------------------------------------ *
   *  Etkinlik yardımcıları
   * ------------------------------------------------------------------ */

  /** Başlangıç/bitiş zamanları (UTC). Saat yoksa tüm gün etkinliği. */
  DV.eventRange = function (ev, tz) {
    if (!dt.parseDate(ev.date)) return null;
    if (!dt.parseTime(ev.start)) {
      return { allDay: true, start: dt.toUtc(ev.date, '00:00', tz), end: dt.toUtc(dt.addDays(ev.date, 1), '00:00', tz) };
    }
    var start = dt.toUtc(ev.date, ev.start, tz);
    var end;
    if (dt.parseTime(ev.end)) {
      end = dt.toUtc(ev.date, ev.end, tz);
      if (end <= start) end = new Date(end.getTime() + 864e5); // gece yarısını geçiyor
    } else {
      end = new Date(start.getTime() + DV.eventType(ev.type).dur * 36e5);
    }
    return { allDay: false, start: start, end: end };
  };

  DV.sortEvents = function (events) {
    return events.slice().sort(function (a, b) {
      var ka = (a.date || '9999') + 'T' + (a.start || '99:99');
      var kb = (b.date || '9999') + 'T' + (b.start || '99:99');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  };

  DV.mainEvent = function (events) {
    var list = events.filter(function (e) { return e.date; });
    for (var i = 0; i < list.length; i++) if (list[i].main) return list[i];
    for (var j = 0; j < list.length; j++) if (list[j].type === 'dugun') return list[j];
    for (var k = 0; k < list.length; k++) if (list[k].type === 'nikah') return list[k];
    return DV.sortEvents(list)[0] || events[0] || null;
  };

  DV.cities = function (events) {
    var seen = {}, out = [];
    events.forEach(function (e) {
      var c = String(e.city || '').trim();
      var key = c.toLocaleLowerCase('tr');
      if (c && !seen[key]) { seen[key] = 1; out.push(c); }
    });
    return out;
  };

  DV.hasCoords = function (ev) {
    return typeof ev.lat === 'number' && typeof ev.lng === 'number' && isFinite(ev.lat) && isFinite(ev.lng);
  };

  DV.fullAddress = function (ev) {
    return [ev.venue, ev.address, ev.city].filter(Boolean).join(', ');
  };

  /** Bir misafir grubu için görünür etkinlikler. group === '*' → hepsi (önizleme). */
  DV.visibleEvents = function (events, group) {
    return events.filter(function (e) {
      if (e.hidden) return false;
      if (group === '*') return true;
      if (!e.groups || !e.groups.length) return true;
      return !!group && e.groups.indexOf(group) >= 0;
    });
  };

  /* ------------------------------------------------------------------ *
   *  Harita / takvim / mesaj bağlantıları
   * ------------------------------------------------------------------ */

  var links = (DV.links = {});

  function coord(ev) { return ev.lat.toFixed(6) + ',' + ev.lng.toFixed(6); }

  links.google = function (ev) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' +
      (DV.hasCoords(ev) ? coord(ev) : encodeURIComponent(DV.fullAddress(ev)));
  };
  links.googlePlace = function (ev) {
    return 'https://www.google.com/maps/search/?api=1&query=' +
      (DV.hasCoords(ev) ? coord(ev) : encodeURIComponent(DV.fullAddress(ev)));
  };
  links.apple = function (ev) {
    return DV.hasCoords(ev)
      ? 'https://maps.apple.com/?daddr=' + coord(ev) + (ev.venue ? '&q=' + encodeURIComponent(ev.venue) : '')
      : 'https://maps.apple.com/?daddr=' + encodeURIComponent(DV.fullAddress(ev));
  };
  links.yandex = function (ev) {
    return DV.hasCoords(ev)
      ? 'https://yandex.com.tr/harita/?rtext=~' + coord(ev) + '&rtt=auto'
      : 'https://yandex.com.tr/harita/?text=' + encodeURIComponent(DV.fullAddress(ev));
  };
  links.waze = function (ev) {
    return DV.hasCoords(ev)
      ? 'https://waze.com/ul?ll=' + coord(ev) + '&navigate=yes'
      : 'https://waze.com/ul?q=' + encodeURIComponent(DV.fullAddress(ev)) + '&navigate=yes';
  };

  DV.coupleNames = function (data, sep) {
    var b = data.couple.bride.name, g = data.couple.groom.name;
    var a = data.couple.order === 'groom' ? [g, b] : [b, g];
    return a.filter(Boolean).join(sep || ' & ');
  };

  function calDetails(ev, data) {
    var lines = [];
    if (ev.note) lines.push(ev.note);
    if (ev.dress) lines.push((data.lang === 'en' ? 'Dress code: ' : 'Kıyafet: ') + ev.dress);
    if (DV.hasCoords(ev) || ev.address) lines.push(links.googlePlace(ev));
    return lines.join('\n');
  }

  function calTitle(ev, data) {
    var names = DV.coupleNames(data);
    return DV.eventName(ev, data.lang) + (names ? ' — ' + names : '');
  }

  links.googleCalendar = function (ev, data) {
    var r = DV.eventRange(ev, data.timezone);
    if (!r) return '';
    var dates = r.allDay
      ? dt.dateStamp(ev.date) + '/' + dt.dateStamp(dt.addDays(ev.date, 1))
      : dt.stamp(r.start) + '/' + dt.stamp(r.end);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(calTitle(ev, data)) +
      '&dates=' + dates +
      '&details=' + encodeURIComponent(calDetails(ev, data)) +
      '&location=' + encodeURIComponent(DV.fullAddress(ev)) +
      '&ctz=' + encodeURIComponent(data.timezone || 'Europe/Istanbul');
  };

  function icsEsc(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function icsFold(line) {
    // RFC 5545: 75 oktetten uzun satırları katla (basitleştirilmiş: karakter bazlı)
    var out = [];
    while (line.length > 73) { out.push(line.slice(0, 73)); line = ' ' + line.slice(73); }
    out.push(line);
    return out.join('\r\n');
  }

  links.ics = function (events, data) {
    var now = dt.stamp(new Date());
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dijital Davetiye//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach(function (ev, i) {
      var r = DV.eventRange(ev, data.timezone);
      if (!r) return;
      L.push('BEGIN:VEVENT');
      L.push('UID:' + (ev.id || 'e' + i) + '-' + dt.dateStamp(ev.date) + '@dijital-davetiye');
      L.push('DTSTAMP:' + now);
      if (r.allDay) {
        L.push('DTSTART;VALUE=DATE:' + dt.dateStamp(ev.date));
        L.push('DTEND;VALUE=DATE:' + dt.dateStamp(dt.addDays(ev.date, 1)));
      } else {
        L.push('DTSTART:' + dt.stamp(r.start));
        L.push('DTEND:' + dt.stamp(r.end));
      }
      L.push('SUMMARY:' + icsEsc(calTitle(ev, data)));
      var loc = DV.fullAddress(ev);
      if (loc) L.push('LOCATION:' + icsEsc(loc));
      if (DV.hasCoords(ev)) L.push('GEO:' + ev.lat.toFixed(6) + ';' + ev.lng.toFixed(6));
      var desc = calDetails(ev, data);
      if (desc) L.push('DESCRIPTION:' + icsEsc(desc));
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(calTitle(ev, data)), 'TRIGGER:-P1D', 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(icsFold).join('\r\n');
  };

  /** Telefonu wa.me biçimine çevirir: 0532 123 45 67 → 905321234567 */
  DV.phoneIntl = function (phone) {
    var d = String(phone || '').replace(/[^\d+]/g, '');
    if (d.indexOf('+') === 0) return d.slice(1);
    if (d.indexOf('00') === 0) return d.slice(2);
    if (/^0\d{10}$/.test(d)) return '90' + d.slice(1);
    if (/^5\d{9}$/.test(d)) return '90' + d;
    return d;
  };

  links.whatsapp = function (phone, text) {
    var p = DV.phoneIntl(phone);
    return 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '');
  };
  links.tel = function (phone) {
    var p = String(phone || '').replace(/[^\d+]/g, '');
    return 'tel:' + p;
  };

  /* ------------------------------------------------------------------ *
   *  Çeviriler (davetiye sayfası)
   * ------------------------------------------------------------------ */

  DV.i18n = {
    tr: {
      kicker: 'Evleniyoruz',
      greeting: 'Sevgili {isim}',
      intro: 'Hayatımızın en özel gününde bu mutluluğu sizinle paylaşmak, sizleri de aramızda görmek istiyoruz.',
      closing: 'Sevgimize ve mutluluğumuza ortak olmanızı dileriz.',
      openInvite: 'Davetiyeyi Aç',
      tapToOpen: 'Açmak için zarfa dokunun',
      program: 'Program',
      invitation: 'Davet',
      countdown: 'Büyük güne kalan',
      days: 'Gün', hours: 'Saat', minutes: 'Dakika', seconds: 'Saniye',
      today: 'Bugün büyük gün!',
      past: 'Bu mutlu günü bizimle paylaştığınız için teşekkür ederiz.',
      directions: 'Yol Tarifi',
      addToCalendar: 'Takvime Ekle',
      addAllToCalendar: 'Tüm Programı Takvime Ekle',
      showMap: 'Harita',
      hideMap: 'Haritayı Gizle',
      copyAddress: 'Adresi Kopyala',
      copied: 'Kopyalandı',
      dress: 'Kıyafet',
      bride: 'Kız Tarafı',
      groom: 'Erkek Tarafı',
      allDay: 'Tüm gün',
      dateTBA: 'Tarih yakında duyurulacak',
      story: 'Hikayemiz',
      gallery: 'Anılarımız',
      info: 'Bilmeniz Gerekenler',
      rsvp: 'Lütfen Cevap Veriniz',
      rsvpBy: 'Katılım durumunuzu {date} tarihine kadar bildirmenizi rica ederiz.',
      rsvpIntro: 'Katılım durumunuzu bize bildirirseniz çok seviniriz.',
      yourName: 'Adınız Soyadınız',
      attendYes: 'Katılacağım',
      attendNo: 'Katılamayacağım',
      guestCount: 'Kişi sayısı',
      whichEvents: 'Katılacağınız etkinlikler',
      message: 'Mesajınız (isteğe bağlı)',
      send: 'Gönder',
      sendWhatsApp: 'WhatsApp ile Gönder',
      sendEmail: 'E-posta ile Gönder',
      openForm: 'Katılım Formunu Aç',
      sending: 'Gönderiliyor…',
      sent: 'Teşekkürler! Yanıtınız bize ulaştı.',
      sentWa: 'WhatsApp açılıyor… Mesajı göndermeyi unutmayın 💌',
      sentMail: 'E-posta uygulamanız açılıyor… Göndermeyi unutmayın 💌',
      sendError: 'Gönderilemedi, lütfen tekrar deneyin.',
      nameRequired: 'Lütfen adınızı yazın.',
      rsvpHeader: 'Katılım Bildirimi',
      rsvpName: 'Ad Soyad',
      rsvpStatus: 'Durum',
      rsvpCount: 'Kişi sayısı',
      rsvpEvents: 'Etkinlikler',
      rsvpNote: 'Not',
      gift: 'Hediye',
      giftDefault: 'Varlığınız bizim için en güzel hediye. Yine de bir şeyler göndermek isteyenler için:',
      holder: 'Alıcı',
      copy: 'Kopyala',
      contacts: 'İletişim',
      call: 'Ara',
      whatsapp: 'WhatsApp',
      music: 'Müzik',
      googleMaps: 'Google Haritalar',
      appleMaps: 'Apple Haritalar',
      yandexMaps: 'Yandex Haritalar',
      waze: 'Waze',
      googleCal: 'Google Takvim',
      icsCal: 'Apple / Outlook Takvim (.ics)',
      close: 'Kapat',
      madeWith: 'Dijital Davetiye ile hazırlandı',
      loadError: 'Davetiye yüklenemedi',
      loadErrorHint: 'Bağlantının eksiksiz kopyalandığından emin olun.',
      people: 'kişi',
      scroll: 'Kaydırın',
      photoAlt: 'Çiftin fotoğrafı',
      previous: 'Önceki',
      next: 'Sonraki',
      family: 'Aileleri'
    },
    en: {
      kicker: "We're getting married",
      greeting: 'Dear {isim}',
      intro: 'Together with our families, we joyfully invite you to celebrate the most special day of our lives with us.',
      closing: "We can't wait to celebrate with you.",
      openInvite: 'Open Invitation',
      tapToOpen: 'Tap the envelope to open',
      program: 'Schedule',
      invitation: 'Invitation',
      countdown: 'Counting down to the big day',
      days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
      today: 'Today is the big day!',
      past: 'Thank you for sharing this happy day with us.',
      directions: 'Directions',
      addToCalendar: 'Add to Calendar',
      addAllToCalendar: 'Add Full Schedule to Calendar',
      showMap: 'Map',
      hideMap: 'Hide Map',
      copyAddress: 'Copy Address',
      copied: 'Copied',
      dress: 'Dress code',
      bride: "Bride's side",
      groom: "Groom's side",
      allDay: 'All day',
      dateTBA: 'Date to be announced',
      story: 'Our Story',
      gallery: 'Moments',
      info: 'Good to Know',
      rsvp: 'RSVP',
      rsvpBy: 'Kindly reply by {date}.',
      rsvpIntro: 'Please let us know if you can join us.',
      yourName: 'Your full name',
      attendYes: 'Joyfully accept',
      attendNo: 'Regretfully decline',
      guestCount: 'Number of guests',
      whichEvents: 'Events you will attend',
      message: 'Message (optional)',
      send: 'Send',
      sendWhatsApp: 'Send via WhatsApp',
      sendEmail: 'Send via Email',
      openForm: 'Open RSVP Form',
      sending: 'Sending…',
      sent: 'Thank you! We received your reply.',
      sentWa: 'Opening WhatsApp… Don\'t forget to tap send 💌',
      sentMail: 'Opening your e-mail app… Don\'t forget to send 💌',
      sendError: 'Could not send, please try again.',
      nameRequired: 'Please enter your name.',
      rsvpHeader: 'RSVP',
      rsvpName: 'Name',
      rsvpStatus: 'Status',
      rsvpCount: 'Guests',
      rsvpEvents: 'Events',
      rsvpNote: 'Note',
      gift: 'Gifts',
      giftDefault: 'Your presence is the greatest gift. If you wish to send something anyway:',
      holder: 'Account holder',
      copy: 'Copy',
      contacts: 'Contact',
      call: 'Call',
      whatsapp: 'WhatsApp',
      music: 'Music',
      googleMaps: 'Google Maps',
      appleMaps: 'Apple Maps',
      yandexMaps: 'Yandex Maps',
      waze: 'Waze',
      googleCal: 'Google Calendar',
      icsCal: 'Apple / Outlook Calendar (.ics)',
      close: 'Close',
      madeWith: 'Made with Dijital Davetiye',
      loadError: 'Invitation could not be loaded',
      loadErrorHint: 'Please make sure the link was copied completely.',
      people: 'guests',
      scroll: 'Scroll',
      photoAlt: 'Photo of the couple',
      previous: 'Previous',
      next: 'Next',
      family: 'Families'
    }
  };

  DV.t = function (lang, key, vars) {
    var dict = DV.i18n[lang] || DV.i18n.tr;
    var s = dict[key] != null ? dict[key] : (DV.i18n.tr[key] != null ? DV.i18n.tr[key] : key);
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  };

  /* ------------------------------------------------------------------ *
   *  Hazır senaryolar (editörde "Hızlı Başlangıç")
   *  day: ana tarihe göre gün farkı · city: 'A' gelin şehri, 'B' damat şehri
   * ------------------------------------------------------------------ */

  DV.PRESETS = [
    {
      id: 'tek-il', name: 'Tek İlde Düğün', desc: 'Kına gecesi ve düğün aynı şehirde',
      events: [
        { type: 'kina', day: -1, start: '20:00', end: '23:59', host: 'bride', city: 'A' },
        { type: 'dugun', day: 0, start: '19:00', end: '23:30', city: 'A', main: true }
      ]
    },
    {
      id: 'iki-il', name: 'İki İlde Düğün', desc: 'Kız tarafı ve erkek tarafı düğünleri farklı şehirlerde',
      events: [
        { type: 'kina', day: -1, start: '20:00', end: '23:59', host: 'bride', city: 'A' },
        { type: 'dugun', day: 0, start: '19:00', end: '23:30', host: 'bride', city: 'A', title: 'Kız Tarafı Düğünü' },
        { type: 'gelinalma', day: 7, start: '12:00', host: 'groom', city: 'A' },
        { type: 'dugun', day: 7, start: '19:00', end: '23:30', host: 'groom', city: 'B', title: 'Erkek Tarafı Düğünü', main: true }
      ]
    },
    {
      id: 'geleneksel', name: 'Geleneksel Tam Program', desc: 'Kına, damat tıraşı, gelin alma, nikah ve düğün',
      events: [
        { type: 'kina', day: -1, start: '20:00', end: '23:59', host: 'bride', city: 'A' },
        { type: 'tiras', day: 0, start: '10:00', host: 'groom', city: 'B' },
        { type: 'gelinalma', day: 0, start: '13:00', city: 'A' },
        { type: 'nikah', day: 0, start: '18:30', city: 'B' },
        { type: 'dugun', day: 0, start: '19:00', end: '23:59', city: 'B', main: true }
      ]
    },
    {
      id: 'nikah-after', name: 'Nikah + After Party', desc: 'Resmi nikah, kokteyl ve gece partisi',
      events: [
        { type: 'nikah', day: 0, start: '18:00', city: 'A', main: true },
        { type: 'kokteyl', day: 0, start: '18:30', end: '20:30', city: 'A' },
        { type: 'after', day: 0, start: '22:00', end: '03:00', city: 'A' }
      ]
    },
    {
      id: 'kir', name: 'Kır Düğünü', desc: 'Gün batımında nikah, ardından yemek ve eğlence',
      events: [
        { type: 'nikah', day: 0, start: '17:30', city: 'A', main: true },
        { type: 'yemek', day: 0, start: '19:00', end: '23:00', city: 'A' },
        { type: 'after', day: 0, start: '23:00', end: '02:00', city: 'A' },
        { type: 'brunch', day: 1, start: '11:00', city: 'A' }
      ]
    },
    {
      id: 'nikah-dugun', name: 'Nikah + Düğün', desc: 'Aynı gün nikah ve düğün töreni',
      events: [
        { type: 'nikah', day: 0, start: '19:00', city: 'A' },
        { type: 'dugun', day: 0, start: '19:30', end: '23:59', city: 'A', main: true }
      ]
    },
    {
      id: 'nisan', name: 'Nişan Davetiyesi', desc: 'Sadece nişan töreni', kicker: 'Nişanlanıyoruz',
      events: [{ type: 'nisan', day: 0, start: '19:00', end: '23:00', city: 'A', main: true }]
    },
    {
      id: 'soz', name: 'Söz / İsteme', desc: 'Aile arasında söz merasimi', kicker: 'Söz Merasimimize Davetlisiniz',
      events: [{ type: 'soz', day: 0, start: '19:00', end: '22:00', city: 'A', main: true }]
    },
    {
      id: 'kina', name: 'Kına Gecesi Davetiyesi', desc: 'Sadece kına gecesi', kicker: 'Kına Gecemize Davetlisiniz',
      events: [{ type: 'kina', day: 0, start: '20:00', end: '23:59', host: 'bride', city: 'A', main: true }]
    }
  ];

  /* ------------------------------------------------------------------ *
   *  Örnek veri (editör ilk açılışta bununla başlar)
   * ------------------------------------------------------------------ */

  DV.sample = function () {
    var d = DV.defaults();
    d.couple.bride = { name: 'Elif', surname: 'Yıldız', parents: 'Ayşe & Mehmet Yıldız' };
    d.couple.groom = { name: 'Can', surname: 'Aydın', parents: 'Zeynep & Ali Aydın' };
    d.couple.hashtag = '#ElifileCan';
    d.texts.quote = 'Seninle her şey yeniden başlıyor.';
    d.texts.signature = 'Elif & Can';
    var ev = function (o) { var e = DV.newEvent(o.type); Object.keys(o).forEach(function (k) { e[k] = o[k]; }); return e; };
    d.events = [
      ev({ type: 'kina', date: '2027-06-11', start: '20:00', end: '23:59', venue: 'Asmalı Bahçe', address: 'Kazımdirik Mah., Bornova', city: 'İzmir', lat: 38.4626, lng: 27.2167, host: 'bride', dress: 'Bordo & altın tonları' }),
      ev({ type: 'gelinalma', date: '2027-06-12', start: '13:00', venue: 'Gelin Evi', address: 'Alsancak Mah., Konak', city: 'İzmir', lat: 38.4386, lng: 27.1481 }),
      ev({ type: 'dugun', title: 'Nikah & Düğün (Kız Tarafı)', date: '2027-06-12', start: '19:00', end: '23:30', venue: 'Kordon Davet Bahçesi', address: 'Atatürk Cad., Alsancak', city: 'İzmir', lat: 38.4337, lng: 27.1428, host: 'bride', dress: 'Şık / Abiye' }),
      ev({ type: 'dugun', title: 'Erkek Tarafı Düğünü', date: '2027-06-19', start: '19:00', end: '23:59', venue: 'Boğaz Davet Bahçesi', address: 'Cevdetpaşa Cad., Bebek, Beşiktaş', city: 'İstanbul', lat: 41.0766, lng: 29.0438, host: 'groom', main: true, dress: 'Şık / Abiye' }),
      ev({ type: 'after', date: '2027-06-20', start: '00:30', end: '04:00', venue: 'Teras Kulüp', address: 'İstiklal Cad., Beyoğlu', city: 'İstanbul', lat: 41.0335, lng: 28.9779, groups: ['arkadaslar'], note: 'Sabaha kadar dans!' })
    ];
    d.story = [
      { date: '2019', title: 'İlk tanışma', text: 'Üniversite kütüphanesinde aynı kitaba uzandığımız gün.' },
      { date: '2023', title: 'İlk tatil', text: 'Kaş\'ta gün batımı ve sonsuz sohbetler.' },
      { date: '2026', title: 'Evlenme teklifi', text: 'Kordon\'da, ilk buluştuğumuz bankta "Evet!"' }
    ];
    d.info = [
      { icon: 'bus', title: 'Servis', text: 'İstanbul düğünü için Kadıköy iskelesinden 18:00\'de servis kalkacaktır.', link: '', linkText: '' },
      { icon: 'parking', title: 'Otopark', text: 'Mekanlarda ücretsiz vale hizmeti bulunmaktadır.', link: '', linkText: '' },
      { icon: 'hotel', title: 'Konaklama', text: 'Şehir dışından gelecek misafirlerimiz için anlaşmalı otel bilgisi için bize ulaşabilirsiniz.', link: '', linkText: '' }
    ];
    d.contacts = [
      { name: 'Ayşe Yıldız', role: 'Gelinin annesi', phone: '0532 000 00 00' },
      { name: 'Ali Aydın', role: 'Damadın babası', phone: '0533 000 00 00' }
    ];
    d.rsvp.whatsapp = '0532 000 00 00';
    d.rsvp.deadline = '2027-05-20';
    d.guests.groups = [{ id: 'aile', name: 'Aile' }, { id: 'arkadaslar', name: 'Arkadaşlar' }, { id: 'is', name: 'İş' }];
    d.guests.list = [
      { id: DV.uid('g'), name: 'Ahmet Bey ve Ailesi', group: 'aile', phone: '', note: '' },
      { id: DV.uid('g'), name: 'Selin', group: 'arkadaslar', phone: '', note: '' }
    ];
    d.guests.message = 'Merhaba {isim}! Düğünümüze davetlisiniz 💍 Davetiyeniz: {link}';
    return d;
  };
})(typeof window !== 'undefined' ? window : this);
