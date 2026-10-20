/*!
 * Dijital Davetiye — davetiye sayfası
 * MIT Lisansı
 *
 * Veri kaynakları (öncelik sırasıyla):
 *   1. window.DV_DATA            → "tek dosya HTML" dışa aktarımı
 *   2. #z.xxxx (URL'nin # kısmı) → paylaşım bağlantısı
 *   3. ?d=slug                   → invitations/slug.json (GitHub deposu)
 *   4. site.config.js → defaultInvitation
 * Ek parametreler: ?to=Misafir Adı  ?g=grup-id  ?t=sablon-id
 *
 * Not: Bu dosya dışa aktarımda <script> içine gömülür; kapanış script etiketi metni içermemelidir.
 */
(function () {
  'use strict';

  var DV = window.DV;
  var doc = document;
  var body = doc.body;
  var esc = DV.esc;
  var icon = DV.icon;

  var S = {
    data: null, design: null, lang: 'tr', events: [],
    guest: '', group: '', preview: false, opened: false,
    timer: null, fx: null, fxKey: '', audio: null, maps: {}, io: null, lb: null
  };

  function t(k, v) { return DV.t(S.lang, k, v); }

  /* ================================================================== *
   *  Açılış
   * ================================================================== */

  function boot() {
    var p = new URL(location.href).searchParams;
    S.guest = (p.get('to') || '').trim().slice(0, 80);
    S.group = (p.get('g') || '').trim().slice(0, 40);

    bindGlobal();

    if (p.has('preview')) {
      S.preview = true;
      body.classList.add('is-preview');
      window.addEventListener('message', onMessage);
      if (window.parent !== window) window.parent.postMessage({ type: 'dv:ready' }, '*');
      return;
    }

    load(p).then(function (raw) {
      var data = DV.normalize(raw);
      var tq = p.get('t');
      if (tq && DV.getTemplate(tq)) data.design.template = tq;
      render(data, { envelope: true });
    }).catch(showError);
  }

  function load(p) {
    if (window.DV_DATA) return Promise.resolve(window.DV_DATA);
    var hash = location.hash.slice(1);
    if (hash && /^(data=)?[zj]\./.test(hash)) return DV.codec.decode(hash);
    var site = window.DV_SITE || {};
    var slug = String(p.get('d') || site.defaultInvitation || 'ornek').replace(/[^a-zA-Z0-9_-]/g, '');
    return fetch('invitations/' + slug + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('invitations/' + slug + '.json (' + r.status + ')');
      return r.json();
    });
  }

  function onMessage(e) {
    if (e.source !== window.parent || !e.data) return;
    var m = e.data;
    if (m.type === 'dv:render') {
      S.guest = m.guest || '';
      S.group = m.group == null ? '*' : m.group;
      if (m.replayEnvelope) {
        S.opened = false;
        var old = doc.getElementById('env');
        if (old) old.remove();
      }
      render(DV.normalize(m.data), { envelope: !!m.replayEnvelope, keepScroll: !m.replayEnvelope });
    } else if (m.type === 'dv:scroll') {
      var el = doc.getElementById('s-' + m.section);
      // scrollIntoView üst pencereyi de kaydırabileceği için yalnızca bu belgeyi kaydır
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
    }
  }

  function showError(err) {
    body.classList.add('ready');
    doc.getElementById('app').innerHTML =
      '<div class="dv-error"><h1>' + esc(t('loadError')) + '</h1><p>' + esc(t('loadErrorHint')) + '</p>' +
      '<p><small>' + esc(err && err.message ? err.message : err) + '</small></p></div>';
    if (window.console) console.error(err);
  }

  /* ================================================================== *
   *  Çizim
   * ================================================================== */

  function render(data, opts) {
    opts = opts || {};
    S.data = data;
    S.lang = data.lang === 'en' ? 'en' : 'tr';
    var D = (S.design = DV.resolveDesign(data));
    doc.documentElement.lang = S.lang;
    applyDesign(data, D);

    var events = DV.visibleEvents(data.events, S.group);
    S.events = events;
    var main = DV.mainEvent(events);
    var y = window.scrollY;

    var html = heroHTML(data, D, events, main);
    data.design.sections.forEach(function (s) {
      if (s.on && SECTIONS[s.id]) html += SECTIONS[s.id](data, D, events, main) || '';
    });
    html += footerHTML(data);

    destroyMaps();
    var app = doc.getElementById('app');
    app.innerHTML = html;

    setupCountdown(data, main);
    setupReveal();
    setupMusic(data);
    setupEffect(D);

    var names = DV.coupleNames(data);
    doc.title = (names ? names + ' | ' : '') + (data.texts.kicker || t('kicker'));

    if (opts.keepScroll) window.scrollTo(0, y);
    if (opts.envelope && data.design.envelope && !S.opened) showEnvelope(data, D, main);
    else if (!doc.getElementById('env')) body.classList.remove('env-open');
  }

  function applyDesign(data, D) {
    var c = D.colors, tc = D.tpl.colors, st = body.style;
    body.setAttribute('data-tpl', D.tpl.id);
    body.setAttribute('data-hero', D.hero);
    body.setAttribute('data-photo', data.design.photoFilter || '');
    body.classList.toggle('is-dark', D.dark);
    st.setProperty('--bg', c.bg);
    st.setProperty('--text', c.text);
    st.setProperty('--primary', c.primary);
    st.setProperty('--accent', c.accent);
    st.setProperty('--surface', D.overridden.bg
      ? (D.dark ? 'color-mix(in srgb, var(--bg) 88%, #ffffff)' : 'color-mix(in srgb, var(--bg) 45%, #ffffff)')
      : tc.surface);
    st.setProperty('--muted', D.overridden.text || D.overridden.bg ? 'color-mix(in srgb, var(--text) 60%, var(--bg))' : tc.muted);
    st.setProperty('--on-primary', DV.readableOn(c.primary));
    st.setProperty('--f-script', DV.fontStack(D.fonts.script, 'script'));
    st.setProperty('--f-head', DV.fontStack(D.fonts.heading, 'serif'));
    st.setProperty('--f-body', DV.fontStack(D.fonts.body, 'sans'));
    DV.loadFonts([D.fonts.script, D.fonts.heading, D.fonts.body]);

    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.bg);

    ensureTemplateCss(D.tpl.id);
  }

  function ensureTemplateCss(id) {
    if (window.DV_EMBEDDED) { body.classList.add('ready'); return; }
    var href = 'templates/' + id + '.css';
    var link = doc.getElementById('tpl-css');
    if (link && link.getAttribute('href') === href) { body.classList.add('ready'); return; }
    if (!link) {
      link = doc.createElement('link');
      link.id = 'tpl-css';
      link.rel = 'stylesheet';
      doc.head.appendChild(link);
    }
    var done = function () { body.classList.add('ready'); };
    link.onload = done;
    link.onerror = done;
    setTimeout(done, 1500);
    link.setAttribute('href', href);
  }

  /* ---------- Kapak ---------- */

  function namesHTML(data) {
    var b = data.couple.bride.name, g = data.couple.groom.name;
    var a = data.couple.order === 'groom' ? [g, b] : [b, g];
    if (!a[0] && !a[1]) a = S.lang === 'en' ? ['Bride', 'Groom'] : ['Gelin', 'Damat'];
    return '<h1 class="names"><span class="n1">' + esc(a[0]) + '</span><span class="amp">&amp;</span><span class="n2">' + esc(a[1]) + '</span></h1>';
  }

  function greetingText(data) {
    return (data.texts.greeting || t('greeting')).split('{isim}').join(S.guest);
  }

  function heroHTML(data, D, events, main) {
    var tpl = D.tpl, layout = D.hero;
    var photo = DV.safeUrl(data.couple.photo, 'image');
    var pos = /^(top|center|bottom)$/.test(data.couple.photoPos) ? data.couple.photoPos : 'center';
    var img = photo ? '<img src="' + esc(photo) + '" alt="' + esc(t('photoAlt')) + '" style="object-position:50% ' + (pos === 'top' ? '20%' : pos === 'bottom' ? '80%' : '50%') + '">' : '';
    var media = layout === 'full' || layout === 'split';

    var cities = DV.cities(events);
    var dateTxt = main && main.date ? DV.dt.formatDate(S.lang, main.date) : '';

    var h = '<header class="hero hero--' + layout + (photo ? ' has-photo' : ' no-photo') + '" id="s-hero">';
    if (media) h += '<div class="hero-media">' + img + '</div>';
    h += '<div class="hero-inner">';
    if (!media && tpl.decor.corner) {
      ['tl', 'tr', 'bl', 'br'].forEach(function (c) { h += '<span class="dc-corner ' + c + '">' + DV.renderDecor(tpl.decor.corner) + '</span>'; });
    }
    if (tpl.decor.top) h += '<div class="dc dc-top">' + DV.renderDecor(tpl.decor.top) + '</div>';
    if (S.guest) h += '<p class="greet">' + esc(greetingText(data)) + '</p>';
    h += '<p class="kicker">' + esc(data.texts.kicker || t('kicker')) + '</p>';
    if (!media && img) h += '<figure class="hero-photo">' + img + '</figure>';
    h += namesHTML(data);
    if (dateTxt) h += '<p class="hero-date"><span>' + esc(dateTxt) + '</span></p>';
    if (cities.length) h += '<span class="hero-place">' + cities.map(esc).join(' &middot; ') + '</span>';
    if (tpl.decor.divider) h += '<div class="dc dc-divider">' + DV.renderDecor(tpl.decor.divider) + '</div>';
    h += '</div>';
    var first = data.design.sections.filter(function (s) { return s.on; })[0];
    h += '<a class="scroll-cue" href="#s-' + (first ? first.id : 'events') + '" aria-label="' + esc(t('scroll')) + '">' + icon('arrowDown') + '</a>';
    return h + '</header>';
  }

  function divider(D) {
    return D.tpl.decor.divider ? '<div class="dc dc-divider">' + DV.renderDecor(D.tpl.decor.divider) + '</div>' : '<div class="dc dc-divider"></div>';
  }

  function sectionHead(D, title, sub) {
    return '<h2 class="sec-title">' + esc(title) + '</h2>' + divider(D) + (sub ? '<p class="sec-sub">' + sub + '</p>' : '');
  }

  /* ---------- Bölümler ---------- */

  var SECTIONS = {};

  SECTIONS.intro = function (data, D) {
    var c = data.couple, h = '';
    var bp = c.bride.parents, gp = c.groom.parents;
    var first = c.order === 'groom' ? gp : bp, second = c.order === 'groom' ? bp : gp;
    if (first || second) {
      h += '<div class="parents' + (first && second ? '' : ' single') + '">';
      if (first) h += '<div class="parent">' + esc(first) + '</div>';
      if (first && second) h += '<span class="parents-sep">&amp;</span>';
      if (second) h += '<div class="parent">' + esc(second) + '</div>';
      h += '</div>';
    }
    if (data.texts.familyLine) h += '<p class="family-line">' + esc(data.texts.familyLine) + '</p>';
    if (h) h += divider(D);
    h += '<p class="lead">' + DV.text(data.texts.intro || t('intro')) + '</p>';
    if (data.texts.quote) {
      h += '<blockquote class="quote">' + DV.text(data.texts.quote) + (data.texts.quoteAuthor ? '<cite>' + esc(data.texts.quoteAuthor) + '</cite>' : '') + '</blockquote>';
    }
    return '<section class="sec intro reveal" id="s-intro">' + h + '</section>';
  };

  SECTIONS.countdown = function (data, D, events, main) {
    if (!main || !main.date) return '';
    var u = function (k, label) { return '<div class="cd-u"><b data-u="' + k + '">0</b><span>' + esc(label) + '</span></div>'; };
    var when = DV.dt.formatDate(S.lang, main.date) + (main.start ? ' · ' + DV.dt.formatTime(S.lang, main.start) : '');
    return '<section class="sec countdown reveal" id="s-countdown">' + sectionHead(D, t('countdown')) +
      '<div class="cd">' + u('d', t('days')) + u('h', t('hours')) + u('m', t('minutes')) + u('s', t('seconds')) + '</div>' +
      '<p class="cd-msg" hidden></p><p class="cd-when">' + esc(DV.eventName(main, S.lang)) + ' · ' + esc(when) + '</p></section>';
  };

  function sameCity(a, b) { return String(a || '').trim().toLocaleLowerCase('tr') === String(b || '').trim().toLocaleLowerCase('tr'); }

  SECTIONS.events = function (data, D, events) {
    if (!events.length) return '';
    var groups = [];
    var cities = DV.cities(events);
    if (data.design.groupByCity && cities.length > 1) {
      cities.forEach(function (c) { groups.push({ city: c, items: events.filter(function (e) { return sameCity(e.city, c); }) }); });
      var rest = events.filter(function (e) { return !String(e.city || '').trim(); });
      if (rest.length) groups.push({ city: '', items: rest });
    } else {
      groups.push({ city: '', items: events });
    }
    var h = '<section class="sec events" id="s-events">' + sectionHead(D, events.length > 1 ? t('program') : t('invitation'));
    h += '<div class="evs evs--' + D.events + '">';
    groups.forEach(function (g) {
      if (g.city) h += '<h3 class="city-title">' + icon('pin') + '<span>' + esc(g.city) + '</span></h3>';
      h += '<div class="ev-list">' + g.items.map(eventHTML).join('') + '</div>';
    });
    h += '</div>';
    if (events.filter(function (e) { return e.date; }).length > 1) {
      h += '<div class="ev-all"><button type="button" class="btn btn-ghost" data-act="cal-all">' + icon('cal') + esc(t('addAllToCalendar')) + '</button></div>';
    }
    return h + '</section>';
  };

  function timeText(ev) {
    if (!ev.start) return ev.date ? t('allDay') : '';
    return DV.dt.formatTime(S.lang, ev.start) + (ev.end ? ' – ' + DV.dt.formatTime(S.lang, ev.end) : '');
  }

  function eventHTML(ev) {
    var type = DV.eventType(ev.type);
    var id = esc(ev.id);
    var p = DV.dt.parts(S.lang, ev.date);
    var time = timeText(ev);
    var hasLoc = DV.hasCoords(ev) || ev.address || ev.venue;
    var addr = [ev.address, ev.city].filter(Boolean).join(', ');

    var h = '<article class="ev reveal' + (ev.main ? ' is-main' : '') + '" data-id="' + id + '">';
    h += '<div class="ev-datebox">' + (p ? '<b>' + esc(p.day) + '</b><span>' + esc(p.monthShort) + '</span>' : icon(type.icon)) + '</div>';
    h += '<div class="ev-body">';
    h += '<div class="ev-icon">' + icon(type.icon) + '</div>';
    if (ev.title) h += '<p class="ev-type">' + esc(type[S.lang] || type.tr) + '</p>';
    h += '<h3 class="ev-title">' + esc(DV.eventName(ev, S.lang)) + '</h3>';
    if (ev.host === 'bride' || ev.host === 'groom') h += '<span class="ev-badge">' + esc(t(ev.host)) + '</span>';
    h += '<p class="ev-when"><span>' + icon('cal') + esc(ev.date ? DV.dt.formatDate(S.lang, ev.date) : t('dateTBA')) + '</span>' +
      (time ? '<span>' + icon('clock') + esc(time) + '</span>' : '') + '</p>';
    if (hasLoc) {
      h += '<p class="ev-where">' + icon('pin') + '<span>' + (ev.venue ? '<strong>' + esc(ev.venue) + '</strong>' : '') +
        (addr ? '<span>' + esc(addr) + '</span>' : '') + '</span></p>';
    }
    if (ev.dress) h += '<p class="ev-meta">' + icon('shirt') + '<span><em>' + esc(t('dress')) + ':</em> ' + esc(ev.dress) + '</span></p>';
    if (ev.note) h += '<p class="ev-note">' + DV.text(ev.note) + '</p>';
    h += '<div class="ev-actions">';
    if (hasLoc) h += '<button type="button" class="btn btn-solid btn-sm" data-act="dir" data-id="' + id + '">' + icon('nav') + esc(t('directions')) + '</button>';
    if (ev.date) h += '<button type="button" class="btn btn-sm" data-act="cal" data-id="' + id + '">' + icon('cal') + esc(t('addToCalendar')) + '</button>';
    if (DV.hasCoords(ev)) h += '<button type="button" class="btn btn-sm btn-ghost" data-act="map" data-id="' + id + '">' + icon('map') + '<span>' + esc(t('showMap')) + '</span></button>';
    h += '</div><div class="ev-map" hidden></div>';
    return h + '</div></article>';
  }

  SECTIONS.story = function (data, D) {
    var items = data.story.filter(function (s) { return s.title || s.text; });
    if (!items.length) return '';
    return '<section class="sec story-sec reveal" id="s-story">' + sectionHead(D, t('story')) + '<ol class="story">' +
      items.map(function (s) {
        return '<li>' + (s.date ? '<span class="st-date">' + esc(s.date) + '</span>' : '') +
          (s.title ? '<h3>' + esc(s.title) + '</h3>' : '') + (s.text ? '<p>' + DV.text(s.text) + '</p>' : '') + '</li>';
      }).join('') + '</ol></section>';
  };

  SECTIONS.gallery = function (data, D) {
    var items = galleryItems(data);
    if (!items.length) return '';
    return '<section class="sec gallery-sec reveal" id="s-gallery">' + sectionHead(D, t('gallery')) + '<div class="gallery">' +
      items.map(function (g, i) {
        return '<button type="button" data-act="gallery" data-i="' + i + '" aria-label="' + esc(g.caption || t('gallery') + ' ' + (i + 1)) + '"><img loading="lazy" src="' + esc(g.src) + '" alt="' + esc(g.caption) + '"></button>';
      }).join('') + '</div></section>';
  };

  function galleryItems(data) {
    return data.gallery.map(function (g) { return { src: DV.safeUrl(g.src, 'image'), caption: g.caption || '' }; }).filter(function (g) { return g.src; });
  }

  SECTIONS.info = function (data, D) {
    var items = data.info.filter(function (x) { return x.title || x.text; });
    if (!items.length) return '';
    return '<section class="sec info-sec reveal" id="s-info">' + sectionHead(D, t('info')) + '<div class="info-grid">' +
      items.map(function (x) {
        var link = DV.safeUrl(x.link, 'link');
        return '<div class="info-card"><span class="info-ic">' + icon(DV.ICONS[x.icon] ? x.icon : 'info') + '</span><div>' +
          (x.title ? '<h3>' + esc(x.title) + '</h3>' : '') + (x.text ? '<p>' + DV.text(x.text) + '</p>' : '') +
          (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('link') + esc(x.linkText || link.replace(/^https?:\/\//, '').slice(0, 40)) + '</a>' : '') +
          '</div></div>';
      }).join('') + '</div></section>';
  };

  SECTIONS.rsvp = function (data, D, events) {
    var r = data.rsvp;
    if (r.method === 'none') return '';
    var sub = r.text ? DV.text(r.text) : esc(r.deadline ? t('rsvpBy', { date: DV.dt.formatDate(S.lang, r.deadline, false) }) : t('rsvpIntro'));
    var h = '<section class="sec rsvp-sec reveal" id="s-rsvp">' + sectionHead(D, t('rsvp'), sub);

    if (r.method === 'link') {
      var url = DV.safeUrl(r.formUrl, 'link');
      if (!url) return '';
      return h + '<a class="btn btn-solid" href="' + esc(url) + '" target="_blank" rel="noopener">' + icon('link') + esc(t('openForm')) + '</a></section>';
    }

    var evs = events.filter(function (e) { return e.date || e.venue; });
    var btn = r.method === 'whatsapp' ? t('sendWhatsApp') : r.method === 'email' ? t('sendEmail') : t('send');
    var btnIcon = r.method === 'whatsapp' ? 'chat' : r.method === 'email' ? 'mail' : 'check';

    h += '<div class="rsvp-card"><form class="rsvp-form" novalidate>';
    h += '<label class="fld"><span>' + esc(t('yourName')) + '</span><input type="text" name="name" autocomplete="name" maxlength="80" value="' + esc(S.guest) + '"></label>';
    h += '<div class="seg" role="radiogroup"><label><input type="radio" name="att" value="yes" checked><span>' + esc(t('attendYes')) + '</span></label>' +
      '<label><input type="radio" name="att" value="no"><span>' + esc(t('attendNo')) + '</span></label></div>';
    if (r.askCount) {
      h += '<div class="fld fld-count"><span>' + esc(t('guestCount')) + '</span><div class="stepper">' +
        '<button type="button" data-act="step" data-step="-1" aria-label="-">&minus;</button>' +
        '<input type="number" name="count" min="1" max="' + r.maxCount + '" value="1" inputmode="numeric" aria-label="' + esc(t('guestCount')) + '">' +
        '<button type="button" data-act="step" data-step="1" aria-label="+">+</button></div></div>';
    }
    if (r.askEvents && evs.length > 1) {
      h += '<fieldset class="rsvp-evs"><legend>' + esc(t('whichEvents')) + '</legend>' + evs.map(function (e) {
        var p = DV.dt.parts(S.lang, e.date);
        return '<label class="chk"><input type="checkbox" name="ev" value="' + esc(e.id) + '" checked><span>' + esc(DV.eventName(e, S.lang)) +
          (p ? ' <small>· ' + esc(p.day + ' ' + p.monthShort) + (e.city ? ' · ' + esc(e.city) : '') + '</small>' : '') + '</span></label>';
      }).join('') + '</fieldset>';
    }
    h += '<label class="fld"><span>' + esc(t('message')) + '</span><textarea name="note" rows="3" maxlength="600"></textarea></label>';
    h += '<button class="btn btn-solid btn-block" type="submit">' + icon(btnIcon) + esc(btn) + '</button>';
    h += '<p class="form-msg" role="status" aria-live="polite"></p>';
    return h + '</form></div></section>';
  };

  function formatIban(s) {
    var c = String(s || '').replace(/\s+/g, '').toUpperCase();
    return c.replace(/(.{4})/g, '$1 ').trim();
  }

  SECTIONS.gift = function (data, D) {
    var acc = data.gift.accounts.filter(function (a) { return a.iban; });
    if (!acc.length && !data.gift.text) return '';
    var h = '<section class="sec gift-sec reveal" id="s-gift">' + sectionHead(D, t('gift'), DV.text(data.gift.text || t('giftDefault')));
    acc.forEach(function (a) {
      var raw = String(a.iban).replace(/\s+/g, '').toUpperCase();
      h += '<div class="acct">' + (a.bank ? '<p class="acct-bank">' + esc(a.bank) + '</p>' : '') +
        (a.holder ? '<p class="acct-holder">' + esc(t('holder')) + ': ' + esc(a.holder) + '</p>' : '') +
        '<p class="acct-iban"><code>' + esc(formatIban(raw)) + '</code><button type="button" class="btn btn-sm btn-ghost" data-act="copy" data-copy="' + esc(raw) + '">' + icon('copy') + esc(t('copy')) + '</button></p></div>';
    });
    return h + '</section>';
  };

  SECTIONS.contacts = function (data, D) {
    var list = data.contacts.filter(function (c) { return c.name && c.phone; });
    if (!list.length) return '';
    return '<section class="sec contacts-sec reveal" id="s-contacts">' + sectionHead(D, t('contacts')) + '<div class="contacts">' +
      list.map(function (c) {
        return '<div class="contact"><div><strong>' + esc(c.name) + '</strong>' + (c.role ? '<span>' + esc(c.role) + '</span>' : '') + '</div>' +
          '<div class="contact-actions"><a class="btn btn-sm btn-ghost" href="' + esc(DV.links.tel(c.phone)) + '">' + icon('phone') + esc(t('call')) + '</a>' +
          '<a class="btn btn-sm" href="' + esc(DV.links.whatsapp(c.phone)) + '" target="_blank" rel="noopener">' + icon('chat') + esc(t('whatsapp')) + '</a></div></div>';
      }).join('') + '</div></section>';
  };

  SECTIONS.closing = function (data, D) {
    var tx = data.texts;
    var sig = tx.signature || DV.coupleNames(data);
    var h = '<section class="sec closing reveal" id="s-closing">' + divider(D) + '<p class="lead">' + DV.text(tx.closing || t('closing')) + '</p>';
    if (sig) h += '<p class="signature">' + esc(sig) + '</p>';
    if (data.couple.hashtag) h += '<button type="button" class="hashtag" data-act="copy" data-copy="' + esc(data.couple.hashtag) + '">' + icon('camera') + esc(data.couple.hashtag) + '</button>';
    return h + '</section>';
  };

  function footerHTML(data) {
    if (!data.design.credit) return '<footer class="foot"></footer>';
    var repo = (window.DV_SITE && window.DV_SITE.repoUrl) || '';
    var label = esc(t('madeWith'));
    return '<footer class="foot">' + (repo ? '<a href="' + esc(DV.safeUrl(repo, 'link')) + '" target="_blank" rel="noopener">' + label + '</a>' : label) + '</footer>';
  }

  /* ================================================================== *
   *  Etkileşimler
   * ================================================================== */

  function findEvent(id) {
    for (var i = 0; i < S.events.length; i++) if (S.events[i].id === id) return S.events[i];
    return null;
  }

  function bindGlobal() {
    doc.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.getAttribute('data-act');
      var ev = findEvent(el.getAttribute('data-id'));
      switch (act) {
        case 'dir': if (ev) openSheet(t('directions'), DV.eventName(ev, S.lang) + (ev.venue ? ' · ' + ev.venue : ''), dirOptions(ev)); break;
        case 'cal': if (ev) openSheet(t('addToCalendar'), DV.eventName(ev, S.lang), calOptions([ev])); break;
        case 'cal-all': openSheet(t('addAllToCalendar'), DV.coupleNames(S.data), calOptions(S.events.filter(function (x) { return x.date; }))); break;
        case 'map': if (ev) toggleMap(ev, el); break;
        case 'copy': copyText(el.getAttribute('data-copy')); break;
        case 'music': toggleMusic(); break;
        case 'gallery': openLightbox(parseInt(el.getAttribute('data-i'), 10) || 0); break;
        case 'sheet-close': closeSheet(); break;
        case 'step': stepCount(el); break;
      }
    });

    doc.addEventListener('submit', function (e) {
      if (e.target.classList.contains('rsvp-form')) { e.preventDefault(); submitRsvp(e.target); }
    });

    doc.addEventListener('change', function (e) {
      if (e.target.name === 'att') {
        var form = e.target.form;
        if (form) form.classList.toggle('is-no', e.target.value === 'no' && e.target.checked);
      }
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeSheet(); closeLightbox(); }
      if (S.lb) {
        if (e.key === 'ArrowRight') moveLightbox(1);
        if (e.key === 'ArrowLeft') moveLightbox(-1);
      }
    });
  }

  function stepCount(btn) {
    var input = btn.parentNode.querySelector('input');
    var max = parseInt(input.max, 10) || 10;
    var v = (parseInt(input.value, 10) || 1) + parseInt(btn.getAttribute('data-step'), 10);
    input.value = Math.max(1, Math.min(max, v));
  }

  /* ---------- Alt sayfa ---------- */

  function dirOptions(ev) {
    var o = [
      { label: t('googleMaps'), icon: 'nav', href: DV.links.google(ev) },
      { label: t('appleMaps'), icon: 'map', href: DV.links.apple(ev) },
      { label: t('yandexMaps'), icon: 'map', href: DV.links.yandex(ev) },
      { label: t('waze'), icon: 'nav', href: DV.links.waze(ev) }
    ];
    var addr = DV.fullAddress(ev);
    if (addr) o.push({ label: t('copyAddress'), icon: 'copy', copy: addr });
    return o;
  }

  function calOptions(events) {
    var o = [];
    if (events.length === 1) o.push({ label: t('googleCal'), icon: 'cal', href: DV.links.googleCalendar(events[0], S.data) });
    else events.forEach(function (ev) { o.push({ label: t('googleCal') + ' — ' + DV.eventName(ev, S.lang), icon: 'cal', href: DV.links.googleCalendar(ev, S.data) }); });
    var ics = DV.links.ics(events, S.data);
    var name = DV.slugify(DV.coupleNames(S.data, ' ') || 'davetiye') + (events.length === 1 ? '-' + DV.slugify(DV.eventName(events[0], S.lang)) : '') + '.ics';
    o.push({ label: t('icsCal'), icon: 'download', href: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics), download: name });
    return o;
  }

  function openSheet(title, sub, options) {
    closeSheet(true);
    var bg = doc.createElement('div');
    bg.className = 'sheet-bg';
    bg.setAttribute('data-act', 'sheet-close');
    var sh = doc.createElement('div');
    sh.className = 'sheet';
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-modal', 'true');
    sh.setAttribute('aria-label', title);
    var h = '<h4>' + esc(title) + '</h4>' + (sub ? '<p>' + esc(sub) + '</p>' : '');
    options.forEach(function (o) {
      if (o.copy) h += '<button type="button" class="opt" data-act="copy" data-copy="' + esc(o.copy) + '">' + icon(o.icon) + '<span>' + esc(o.label) + '</span></button>';
      else h += '<a class="opt" href="' + esc(o.href) + '"' + (o.download ? ' download="' + esc(o.download) + '"' : ' target="_blank" rel="noopener"') + '>' + icon(o.icon) + '<span>' + esc(o.label) + '</span></a>';
    });
    h += '<button type="button" class="opt" data-act="sheet-close">' + icon('x') + '<span>' + esc(t('close')) + '</span></button>';
    sh.innerHTML = h;
    sh.addEventListener('click', function (e) {
      if (e.target.closest('a.opt')) setTimeout(closeSheet, 150);
    });
    body.appendChild(bg);
    body.appendChild(sh);
    requestAnimationFrame(function () { bg.classList.add('open'); sh.classList.add('open'); var f = sh.querySelector('.opt'); if (f) f.focus({ preventScroll: true }); });
  }

  function closeSheet(instant) {
    var sh = doc.querySelector('.sheet'), bg = doc.querySelector('.sheet-bg');
    if (!sh) return;
    if (instant) { sh.remove(); if (bg) bg.remove(); return; }
    sh.classList.remove('open');
    if (bg) bg.classList.remove('open');
    setTimeout(function () { sh.remove(); if (bg) bg.remove(); }, 320);
  }

  /* ---------- Kopyalama / bildirim ---------- */

  function copyText(text) {
    var fallback = function () {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
      body.appendChild(ta);
      ta.select();
      try { doc.execCommand('copy'); } catch (e) { /* yoksay */ }
      ta.remove();
    };
    var p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(text) : Promise.reject();
    p.catch(fallback).then(function () { toast(t('copied')); });
  }

  var toastTimer;
  function toast(msg) {
    var el = doc.querySelector('.toast');
    if (!el) { el = doc.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  /* ---------- Harita ---------- */

  function destroyMaps() {
    Object.keys(S.maps).forEach(function (k) { try { S.maps[k].remove(); } catch (e) { /* yoksay */ } });
    S.maps = {};
  }

  function toggleMap(ev, btn) {
    var box = btn.closest('.ev').querySelector('.ev-map');
    var label = btn.querySelector('span');
    if (!box.hidden) {
      box.hidden = true;
      if (label) label.textContent = t('showMap');
      return;
    }
    box.hidden = false;
    if (label) label.textContent = t('hideMap');
    if (S.maps[ev.id]) { S.maps[ev.id].invalidateSize(); return; }
    DV.loadLeaflet().then(function (L) {
      var map = L.map(box, { scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: false, zoomControl: true }).setView([ev.lat, ev.lng], 15);
      DV.tileLayer(L).addTo(map);
      if (S.design.dark) box.classList.add('dv-map-dark');
      L.marker([ev.lat, ev.lng], { icon: L.divIcon({ className: '', html: '<div class="dv-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] }) })
        .addTo(map)
        .bindPopup('<strong>' + esc(ev.venue || DV.eventName(ev, S.lang)) + '</strong><br>' + esc([ev.address, ev.city].filter(Boolean).join(', ')));
      S.maps[ev.id] = map;
      setTimeout(function () { map.invalidateSize(); }, 60);
    }).catch(function () {
      box.innerHTML = '<iframe title="map" style="border:0;width:100%;height:100%" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=' +
        (ev.lng - 0.01) + ',' + (ev.lat - 0.006) + ',' + (ev.lng + 0.01) + ',' + (ev.lat + 0.006) + '&layer=mapnik&marker=' + ev.lat + ',' + ev.lng + '"></iframe>';
    });
  }

  /* ---------- Geri sayım ---------- */

  function setupCountdown(data, main) {
    clearInterval(S.timer);
    var box = doc.querySelector('.cd');
    if (!box || !main) return;
    var range = DV.eventRange(main, data.timezone);
    if (!range) return;
    var msg = doc.querySelector('.cd-msg');
    var els = {};
    ['d', 'h', 'm', 's'].forEach(function (k) { els[k] = box.querySelector('[data-u="' + k + '"]'); });
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var tick = function () {
      var now = Date.now();
      var diff = range.start.getTime() - now;
      if (diff <= 0) {
        clearInterval(S.timer);
        box.hidden = true;
        msg.hidden = false;
        msg.textContent = now < range.end.getTime() + 6 * 36e5 ? t('today') : t('past');
        return;
      }
      var s = Math.floor(diff / 1000);
      els.d.textContent = Math.floor(s / 86400);
      els.h.textContent = pad(Math.floor((s % 86400) / 3600));
      els.m.textContent = pad(Math.floor((s % 3600) / 60));
      els.s.textContent = pad(s % 60);
    };
    tick();
    S.timer = setInterval(tick, 1000);
  }

  /* ---------- Kayarak belirme ---------- */

  function setupReveal() {
    if (S.io) { S.io.disconnect(); S.io = null; }
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (S.preview || reduce || !('IntersectionObserver' in window)) { body.classList.remove('anim'); return; }
    body.classList.add('anim');
    S.io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); S.io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    doc.querySelectorAll('.reveal').forEach(function (el) { S.io.observe(el); });
  }

  /* ---------- Zarf ---------- */

  function initials(data) {
    var b = data.couple.bride.name, g = data.couple.groom.name;
    var a = data.couple.order === 'groom' ? [g, b] : [b, g];
    return a.filter(Boolean).map(function (n) { return n.trim().charAt(0).toLocaleUpperCase(S.lang === 'en' ? 'en' : 'tr'); }).join('&');
  }

  function showEnvelope(data, D, main) {
    var old = doc.getElementById('env');
    if (old) old.remove();
    body.classList.add('env-open');
    var names = DV.coupleNames(data) || (S.lang === 'en' ? 'Bride & Groom' : 'Gelin & Damat');
    var date = main && main.date ? DV.dt.formatDate(S.lang, main.date, false) : '';
    var env = doc.createElement('div');
    env.className = 'env';
    env.id = 'env';
    env.innerHTML =
      '<div class="env-wrap">' +
      '<p class="env-to">' + esc(S.guest ? greetingText(data) : names) + '</p>' +
      '<div class="env-box" role="button" tabindex="0" aria-label="' + esc(t('openInvite')) + '">' +
      '<div class="env-back"></div>' +
      '<div class="env-letter"><span>' + esc(names) + '</span>' + (date ? '<small>' + esc(date) + '</small>' : '') + '</div>' +
      '<div class="env-front"></div><div class="env-flap"></div>' +
      '<span class="env-seal">' + esc(initials(data) || '♥') + '</span>' +
      '</div>' +
      '<button type="button" class="env-btn">' + esc(t('openInvite')) + '</button>' +
      '<p class="env-hint">' + esc(t('tapToOpen')) + '</p>' +
      '</div>';
    body.appendChild(env);

    var open = function () {
      if (env.classList.contains('opening')) return;
      env.classList.add('opening');
      S.opened = true;
      if (S.audio && data.music.autoplay && !S.preview) playMusic();
      setTimeout(function () {
        env.classList.add('gone');
        body.classList.remove('env-open');
        window.scrollTo(0, 0);
      }, 1650);
      setTimeout(function () { env.remove(); }, 2600);
    };
    env.querySelector('.env-box').addEventListener('click', open);
    env.querySelector('.env-btn').addEventListener('click', open);
    env.querySelector('.env-box').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  }

  /* ---------- Müzik ---------- */

  function setupMusic(data) {
    var url = DV.safeUrl(data.music.url, 'audio');
    var btn = doc.getElementById('music-btn');
    if (!url) {
      if (S.audio) { S.audio.pause(); S.audio = null; }
      if (btn) btn.remove();
      return;
    }
    if (!S.audio || S.audio.getAttribute('data-src') !== url) {
      if (S.audio) S.audio.pause();
      S.audio = new Audio();
      S.audio.loop = true;
      S.audio.preload = 'none';
      S.audio.src = url;
      S.audio.setAttribute('data-src', url);
    }
    if (!btn) {
      btn = doc.createElement('button');
      btn.type = 'button';
      btn.id = 'music-btn';
      btn.className = 'music-btn';
      btn.setAttribute('data-act', 'music');
      body.appendChild(btn);
    }
    btn.setAttribute('aria-label', t('music') + (data.music.title ? ': ' + data.music.title : ''));
    btn.title = data.music.title || t('music');
    updateMusicBtn();
  }

  function updateMusicBtn() {
    var btn = doc.getElementById('music-btn');
    if (!btn || !S.audio) return;
    var playing = !S.audio.paused;
    btn.classList.toggle('playing', playing);
    btn.innerHTML = icon(playing ? 'volume' : 'mute');
  }

  function playMusic() {
    if (!S.audio) return;
    var p = S.audio.play();
    if (p && p.then) p.then(updateMusicBtn).catch(updateMusicBtn);
    else updateMusicBtn();
  }

  function toggleMusic() {
    if (!S.audio) return;
    if (S.audio.paused) playMusic();
    else { S.audio.pause(); updateMusicBtn(); }
  }

  /* ---------- Galeri ışık kutusu ---------- */

  function openLightbox(i) {
    var items = galleryItems(S.data);
    if (!items.length) return;
    closeLightbox();
    var lb = doc.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML = '<img alt=""><p></p>' +
      '<button type="button" class="lb-btn lb-close" aria-label="' + esc(t('close')) + '">' + icon('x') + '</button>' +
      (items.length > 1 ? '<button type="button" class="lb-btn lb-prev" aria-label="' + esc(t('previous')) + '">' + icon('left') + '</button>' +
        '<button type="button" class="lb-btn lb-next" aria-label="' + esc(t('next')) + '">' + icon('right') + '</button>' : '');
    body.appendChild(lb);
    S.lb = { el: lb, items: items, i: i };
    lb.addEventListener('click', function (e) {
      if (e.target.closest('.lb-close') || e.target === lb) closeLightbox();
      else if (e.target.closest('.lb-prev')) moveLightbox(-1);
      else if (e.target.closest('.lb-next')) moveLightbox(1);
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) moveLightbox(dx < 0 ? 1 : -1);
      x0 = null;
    });
    moveLightbox(0);
    lb.querySelector('.lb-close').focus();
  }

  function moveLightbox(d) {
    if (!S.lb) return;
    var n = S.lb.items.length;
    S.lb.i = (S.lb.i + d + n) % n;
    var it = S.lb.items[S.lb.i];
    S.lb.el.querySelector('img').src = it.src;
    S.lb.el.querySelector('img').alt = it.caption;
    S.lb.el.querySelector('p').textContent = it.caption;
  }

  function closeLightbox() {
    if (S.lb) { S.lb.el.remove(); S.lb = null; }
  }

  /* ---------- LCV gönderimi ---------- */

  function formMsg(form, text, kind) {
    var p = form.querySelector('.form-msg');
    p.textContent = text;
    p.className = 'form-msg' + (kind ? ' ' + kind : '');
  }

  function submitRsvp(form) {
    var r = S.data.rsvp;
    var fd = new FormData(form);
    var name = String(fd.get('name') || '').trim();
    if (!name) { formMsg(form, t('nameRequired'), 'err'); form.querySelector('[name=name]').focus(); return; }
    var yes = fd.get('att') !== 'no';
    var count = yes ? Math.max(1, Math.min(r.maxCount, parseInt(fd.get('count'), 10) || 1)) : 0;
    var ids = fd.getAll('ev');
    var evNames = S.events.filter(function (e) { return ids.indexOf(e.id) >= 0; }).map(function (e) { return DV.eventName(e, S.lang); });
    var note = String(fd.get('note') || '').trim();
    var couple = DV.coupleNames(S.data);

    var payload = {
      name: name,
      attending: yes ? 'evet' : 'hayir',
      attendingText: yes ? t('attendYes') : t('attendNo'),
      count: count,
      events: yes ? evNames.join(', ') : '',
      note: note,
      group: S.group && S.group !== '*' ? S.group : '',
      invitation: couple,
      sentAt: new Date().toISOString()
    };

    var lines = ['💌 ' + t('rsvpHeader') + (couple ? ' — ' + couple : ''), t('rsvpName') + ': ' + name, t('rsvpStatus') + ': ' + payload.attendingText];
    if (yes && r.askCount) lines.push(t('rsvpCount') + ': ' + count);
    if (yes && evNames.length && form.querySelector('.rsvp-evs')) lines.push(t('rsvpEvents') + ': ' + payload.events);
    if (note) lines.push(t('rsvpNote') + ': ' + note);
    var text = lines.join('\n');

    if (r.method === 'whatsapp') {
      window.open(DV.links.whatsapp(r.whatsapp, text), '_blank', 'noopener');
      formMsg(form, t('sentWa'), 'ok');
      return;
    }
    if (r.method === 'email') {
      location.href = 'mailto:' + encodeURIComponent(r.email).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(t('rsvpHeader') + (couple ? ' — ' + couple : '')) + '&body=' + encodeURIComponent(text);
      formMsg(form, t('sentMail'), 'ok');
      return;
    }

    var url = DV.safeUrl(r.endpoint, 'link');
    if (!/^https:\/\//i.test(url)) { formMsg(form, t('sendError'), 'err'); return; }
    var btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    formMsg(form, t('sending'));
    var req = r.method === 'sheets'
      ? fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      : fetch(url, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) { if (!res.ok) throw new Error(res.status); });
    req.then(function () {
      formMsg(form, t('sent'), 'ok');
      form.reset();
      form.classList.remove('is-no');
    }).catch(function () {
      formMsg(form, t('sendError'), 'err');
    }).then(function () { btn.disabled = false; });
  }

  /* ================================================================== *
   *  Parçacık efektleri (gül yaprağı, kar, yıldız…)
   * ================================================================== */

  function setupEffect(D) {
    var key = D.effect + '|' + D.colors.primary + '|' + D.colors.accent;
    if (S.fxKey === key) return;
    S.fxKey = key;
    if (S.fx) { S.fx.stop(); S.fx = null; }
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!D.effect || D.effect === 'none' || reduce) return;
    S.fx = particles(D.effect, D.colors);
  }

  function particles(type, colors) {
    var CONF = {
      petals: { n: 16, colors: [colors.accent, colors.primary, '#ffffff'] },
      leaves: { n: 12, colors: [colors.primary, colors.accent] },
      sparkle: { n: 26, colors: [colors.primary, colors.accent] },
      stars: { n: 80, colors: [colors.primary, '#ffffff', colors.accent] },
      snow: { n: 55, colors: ['#ffffff'] },
      hearts: { n: 14, colors: [colors.primary, colors.accent] },
      confetti: { n: 36, colors: [colors.primary, colors.accent, '#f2c14e', '#ef6f6c', '#7ec8e3'] },
      fireflies: { n: 20, colors: [colors.accent, '#ffe7a3'] }
    };
    var conf = CONF[type];
    if (!conf) return null;
    var c = doc.createElement('canvas');
    c.className = 'fx fx--' + type;
    c.setAttribute('aria-hidden', 'true');
    body.appendChild(c);
    var ctx = c.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, parts = [], raf = 0, alive = true, tick = 0;
    var rnd = Math.random;

    function resize() {
      W = c.width = Math.round(innerWidth * dpr);
      H = c.height = Math.round(innerHeight * dpr);
    }

    function spawn(initial) {
      var p = {
        x: rnd() * W, y: initial ? rnd() * H : -20 * dpr,
        s: (0.6 + rnd() * 0.8) * dpr, r: rnd() * Math.PI * 2, vr: (rnd() - 0.5) * 0.04,
        vx: (rnd() - 0.5) * 0.4 * dpr, vy: (0.45 + rnd() * 0.8) * dpr,
        ph: rnd() * Math.PI * 2, c: conf.colors[Math.floor(rnd() * conf.colors.length)], a: 0.45 + rnd() * 0.45, life: 0, max: 0
      };
      if (type === 'sparkle' || type === 'fireflies') {
        p.y = rnd() * H; p.vy = -(0.08 + rnd() * 0.25) * dpr; p.max = 220 + rnd() * 320; p.life = initial ? rnd() * p.max : 0;
      } else if (type === 'stars') {
        p.y = rnd() * H; p.vy = 0; p.vx = 0; p.s = (0.35 + rnd() * 1.1) * dpr;
      } else if (type === 'hearts') {
        p.y = initial ? rnd() * H : H + 20 * dpr; p.vy = -(0.35 + rnd() * 0.55) * dpr;
      } else if (type === 'snow') {
        p.vy = (0.3 + rnd() * 0.9) * dpr; p.s = (0.5 + rnd() * 1.5) * dpr; p.a = 0.6 + rnd() * 0.4;
      }
      return p;
    }

    function heart(x, y, s) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
      ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
      ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
      ctx.fill();
    }

    function star(x, y, s) {
      var k = s * 0.24;
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.lineTo(x + k, y - k); ctx.lineTo(x + s, y); ctx.lineTo(x + k, y + k);
      ctx.lineTo(x, y + s); ctx.lineTo(x - k, y + k); ctx.lineTo(x - s, y); ctx.lineTo(x - k, y - k);
      ctx.closePath(); ctx.fill();
    }

    function draw(p) {
      ctx.fillStyle = p.c;
      switch (type) {
        case 'petals':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, 0.55 + 0.45 * Math.cos(p.ph + tick * 0.03));
          ctx.globalAlpha = p.a * 0.85;
          ctx.beginPath(); ctx.ellipse(0, 0, 7 * p.s, 4.6 * p.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); break;
        case 'leaves':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = p.a * 0.8;
          ctx.beginPath(); ctx.moveTo(-9 * p.s, 0); ctx.quadraticCurveTo(0, -5 * p.s, 9 * p.s, 0); ctx.quadraticCurveTo(0, 5 * p.s, -9 * p.s, 0); ctx.fill(); ctx.restore(); break;
        case 'snow':
          ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 * p.s, 0, Math.PI * 2); ctx.fill(); break;
        case 'sparkle':
          ctx.globalAlpha = Math.max(0, Math.sin(p.life / p.max * Math.PI)) * p.a; star(p.x, p.y, 4.5 * p.s); break;
        case 'stars':
          ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(p.ph + tick * 0.012 * p.s));
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); break;
        case 'hearts':
          ctx.globalAlpha = p.a * 0.7; heart(p.x, p.y, 11 * p.s); break;
        case 'confetti':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.ph + tick * 0.08)); ctx.globalAlpha = p.a;
          ctx.fillRect(-4 * p.s, -2 * p.s, 8 * p.s, 4 * p.s); ctx.restore(); break;
        case 'fireflies':
          var al = Math.max(0, Math.sin(p.life / p.max * Math.PI)) * (0.6 + 0.4 * Math.sin(tick * 0.1 + p.ph));
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9 * p.s);
          g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = al; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 9 * p.s, 0, Math.PI * 2); ctx.fill(); break;
      }
    }

    function frame() {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (doc.hidden) return;
      tick++;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.x += p.vx + Math.sin(p.ph + tick * 0.012) * 0.35 * dpr;
        p.y += p.vy;
        p.r += p.vr;
        if (p.max) p.life++;
        var out = p.y > H + 30 * dpr || p.y < -40 * dpr || p.x < -40 * dpr || p.x > W + 40 * dpr || (p.max && p.life > p.max);
        if (out && type !== 'stars') parts[i] = spawn(false);
        draw(p);
      }
      ctx.globalAlpha = 1;
    }

    resize();
    for (var i = 0; i < conf.n; i++) parts.push(spawn(true));
    window.addEventListener('resize', resize);
    frame();

    return {
      stop: function () {
        alive = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        c.remove();
      }
    };
  }

  // Dış erişim (editör / geliştirici araçları için)
  DV.invite = { render: render };

  boot();
})();
