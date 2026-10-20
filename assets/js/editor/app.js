/*!
 * Dijital Davetiye — editör çatısı
 * Durum yönetimi, otomatik kayıt (IndexedDB), form bağlama, canlı önizleme.
 * MIT Lisansı
 */
(function () {
  'use strict';

  var DV = window.DV;
  var doc = document;
  var esc = DV.esc;

  var ed = (DV.ed = {
    state: null,
    ui: { tab: 'baslangic', openEvent: null, device: 'phone', pvGroup: '*', pvGuest: '' },
    tabs: {},
    order: [],
    actions: {}
  });

  var $ = (ed.$ = function (sel, root) { return (root || doc).querySelector(sel); });
  ed.$$ = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };

  /** Paneli öğeye kaydırır (scrollIntoView tüm sayfayı kaydırdığı için kullanılmaz). */
  ed.scrollPanelTo = function (el, block) {
    var panel = $('#panel');
    if (!el || !panel) return;
    var r = el.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    var top = panel.scrollTop + r.top - pr.top - 12;
    if (block === 'nearest') {
      if (r.top >= pr.top && r.bottom <= pr.bottom) return;
      if (r.bottom > pr.bottom && r.height < pr.height) top = panel.scrollTop + r.bottom - pr.bottom + 12;
    } else if (block === 'center') {
      top -= (pr.height - r.height) / 2 - 12;
    }
    panel.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };
  ed.icon = DV.icon;

  /* ------------------------------------------------------------------ *
   *  Depolama — IndexedDB (fotoğraflar için yeterli alan), yedek: localStorage
   * ------------------------------------------------------------------ */

  var DB_NAME = 'dijital-davetiye', STORE = 'kv', dbp = null;

  function db() {
    if (!dbp) {
      dbp = new Promise(function (res, rej) {
        if (!window.indexedDB) { rej(new Error('IndexedDB yok')); return; }
        var r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    }
    return dbp;
  }

  ed.store = {
    get: function (key) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var q = d.transaction(STORE).objectStore(STORE).get(key);
          q.onsuccess = function () { res(q.result); };
          q.onerror = function () { rej(q.error); };
        });
      }).catch(function () {
        try { return JSON.parse(localStorage.getItem('dv:' + key)); } catch (e) { return null; }
      });
    },
    set: function (key, val) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(val, key);
          tx.oncomplete = function () { res(); };
          tx.onerror = function () { rej(tx.error); };
        });
      }).catch(function () {
        localStorage.setItem('dv:' + key, JSON.stringify(val));
      });
    }
  };

  function setStatus(kind) {
    var el = $('#saveStatus');
    if (!el) return;
    el.className = 'ed-status is-' + kind;
    el.innerHTML = kind === 'saving' ? 'Kaydediliyor…' : kind === 'error' ? DV.icon('info') + ' Tarayıcıya kaydedilemedi — projeyi dosya olarak kaydedin' : DV.icon('check') + ' Tarayıcıya kaydedildi';
  }

  var saveSoon = DV.debounce(function () {
    ed.store.set('project', ed.state).then(function () { setStatus('saved'); }).catch(function () { setStatus('error'); });
  }, 500);

  /* ------------------------------------------------------------------ *
   *  Değişiklik akışı
   * ------------------------------------------------------------------ */

  ed.changed = function (opts) {
    opts = opts || {};
    setStatus('saving');
    saveSoon();
    ed.pushPreview();
    if (opts.rerender) ed.render(true);
  };

  ed.setState = function (data, msg) {
    ed.state = DV.normalize(data);
    ed.ui.openEvent = null;
    ed.changed();
    ed.render();
    if (msg) ed.toast(msg);
  };

  /* ------------------------------------------------------------------ *
   *  Önizleme (iframe ile postMessage)
   * ------------------------------------------------------------------ */

  var pvReady = false;

  function post(msg) {
    var f = $('#pv');
    if (f && f.contentWindow && pvReady) f.contentWindow.postMessage(msg, '*');
  }

  ed.renderPreview = function (replay) {
    post({
      type: 'dv:render',
      data: DV.inviteData(ed.state),
      group: ed.ui.pvGroup,
      guest: ed.ui.pvGuest,
      replayEnvelope: !!replay
    });
  };
  ed.pushPreview = DV.debounce(function () { ed.renderPreview(false); }, 180);

  ed.scrollPreview = function (section) {
    if (section) post({ type: 'dv:scroll', section: section });
  };

  window.addEventListener('message', function (e) {
    var f = $('#pv');
    if (!f || e.source !== f.contentWindow || !e.data) return;
    if (e.data.type === 'dv:ready') {
      pvReady = true;
      ed.renderPreview(false);
    }
  });

  function fitPreview() {
    var stage = $('#pvStage'), dev = $('#pvDevice');
    if (!stage || !dev) return;
    var W = stage.clientWidth - 32, H = stage.clientHeight - 32;
    if (ed.ui.device === 'phone') {
      var s = Math.min(1, W / 390, H / 844);
      dev.style.width = '390px';
      dev.style.height = '844px';
      dev.style.transform = 'scale(' + s + ')';
    } else {
      var s2 = Math.min(1, W / 1280);
      dev.style.width = '1280px';
      dev.style.height = Math.round(H / s2) + 'px';
      dev.style.transform = 'scale(' + s2 + ')';
    }
    dev.className = 'pv-device ' + ed.ui.device;
  }
  ed.fitPreview = fitPreview;

  /* ------------------------------------------------------------------ *
   *  Form alanı üreticileri — data-bind="yol.alan" ile duruma bağlanır
   * ------------------------------------------------------------------ */

  var fid = 0;
  function attrs(o) {
    var a = '';
    if (o.rerender) a += ' data-rerender';
    if (o.placeholder) a += ' placeholder="' + esc(o.placeholder) + '"';
    if (o.min != null) a += ' min="' + o.min + '"';
    if (o.max != null) a += ' max="' + o.max + '"';
    if (o.maxlength) a += ' maxlength="' + o.maxlength + '"';
    if (o.inputmode) a += ' inputmode="' + o.inputmode + '"';
    if (o.autocomplete) a += ' autocomplete="' + o.autocomplete + '"';
    return a;
  }

  function wrap(o, id, input) {
    return '<div class="fld' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.label ? '<label for="' + id + '">' + esc(o.label) + (o.optional ? ' <em>isteğe bağlı</em>' : '') + '</label>' : '') +
      input + (o.hint ? '<p class="hint">' + o.hint + '</p>' : '') + '</div>';
  }

  ed.f = {
    text: function (bind, label, o) {
      o = o || {}; o.label = label;
      var id = 'f' + (++fid);
      return wrap(o, id, '<input type="' + (o.type || 'text') + '" id="' + id + '" data-bind="' + bind + '"' + (o.number ? ' data-type="number"' : '') + attrs(o) + '>');
    },
    number: function (bind, label, o) { o = o || {}; o.type = 'number'; o.number = true; o.inputmode = 'numeric'; return ed.f.text(bind, label, o); },
    date: function (bind, label, o) { o = o || {}; o.type = 'date'; return ed.f.text(bind, label, o); },
    time: function (bind, label, o) { o = o || {}; o.type = 'time'; return ed.f.text(bind, label, o); },
    area: function (bind, label, o) {
      o = o || {}; o.label = label;
      var id = 'f' + (++fid);
      return wrap(o, id, '<textarea id="' + id + '" rows="' + (o.rows || 3) + '" data-bind="' + bind + '"' + attrs(o) + '></textarea>');
    },
    select: function (bind, label, options, o) {
      o = o || {}; o.label = label;
      var id = 'f' + (++fid);
      var opts = options.map(function (x) {
        if (x.group) return '<optgroup label="' + esc(x.group) + '">' + x.items.map(function (y) { return '<option value="' + esc(y[0]) + '">' + esc(y[1]) + '</option>'; }).join('') + '</optgroup>';
        return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>';
      }).join('');
      return wrap(o, id, '<select id="' + id + '" data-bind="' + bind + '"' + attrs(o) + '>' + opts + '</select>');
    },
    check: function (bind, label, o) {
      o = o || {};
      return '<label class="sw' + (o.cls ? ' ' + o.cls : '') + '"><input type="checkbox" data-bind="' + bind + '"' + (o.rerender ? ' data-rerender' : '') + '><span class="sw-ui" aria-hidden="true"></span><span class="sw-l">' + esc(label) + (o.hint ? '<small>' + o.hint + '</small>' : '') + '</span></label>';
    },
    row: function () {
      return '<div class="row">' + Array.prototype.slice.call(arguments).join('') + '</div>';
    }
  };

  /** Bölüm kartı */
  ed.card = function (title, body, o) {
    o = o || {};
    return '<section class="card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
      (title ? '<header class="card-h"><h3>' + (o.icon ? DV.icon(o.icon) : '') + esc(title) + '</h3>' + (o.desc ? '<p>' + o.desc + '</p>' : '') + '</header>' : '') +
      '<div class="card-b">' + body + '</div></section>';
  };

  /** Liste öğesi araç çubuğu (yukarı / aşağı / sil) */
  ed.itemTools = function (path, i, len) {
    return '<div class="it-tools">' +
      '<button type="button" class="ib" data-action="list-up" data-path="' + path + '" data-i="' + i + '" title="Yukarı taşı"' + (i === 0 ? ' disabled' : '') + '>' + DV.icon('chevron', 'rot180') + '</button>' +
      '<button type="button" class="ib" data-action="list-down" data-path="' + path + '" data-i="' + i + '" title="Aşağı taşı"' + (i === len - 1 ? ' disabled' : '') + '>' + DV.icon('chevron') + '</button>' +
      '<button type="button" class="ib danger" data-action="list-del" data-path="' + path + '" data-i="' + i + '" title="Sil">' + DV.icon('x') + '</button>' +
      '</div>';
  };

  function hydrate(root) {
    ed.$$('[data-bind]', root).forEach(function (el) {
      var v = DV.get(ed.state, el.getAttribute('data-bind'));
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
    ed.$$('[data-url-for]', root).forEach(function (el) {
      var v = DV.get(ed.state, el.getAttribute('data-url-for')) || '';
      el.value = DV.isDataUrl(v) ? '' : v;
    });
  }
  ed.hydrate = hydrate;

  function onInput(e) {
    var el = e.target;
    var isChange = e.type === 'change';

    if (el.hasAttribute('data-url-for')) {
      if (!isChange) return;
      DV.set(ed.state, el.getAttribute('data-url-for'), el.value.trim());
      ed.changed({ rerender: true });
      return;
    }
    if (el.hasAttribute('data-upload')) { if (isChange) handleUpload(el); return; }
    if (el.hasAttribute('data-hook')) { if (isChange && ed.hooks[el.getAttribute('data-hook')]) ed.hooks[el.getAttribute('data-hook')](el); return; }

    var path = el.getAttribute('data-bind');
    if (!path) return;
    var v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.getAttribute('data-type') === 'number') v = v === '' ? null : Number(v);
    var cur = DV.get(ed.state, path);
    if (cur === v && !isChange) return;
    DV.set(ed.state, path, v);

    // Tek ana etkinlik
    var m = /^events\.(\d+)\.main$/.exec(path);
    if (m && v) ed.state.events.forEach(function (ev, i) { if (i !== +m[1]) ev.main = false; });

    // Etkinlik başlığını yerinde güncelle (odak kaybolmasın)
    var em = /^events\.(\d+)\./.exec(path);
    if (em && ed.refreshEventHead) ed.refreshEventHead(+em[1]);

    ed.changed({ rerender: isChange && el.hasAttribute('data-rerender') });
  }

  ed.hooks = {};

  /* ------------------------------------------------------------------ *
   *  Fotoğraf / müzik yükleme
   * ------------------------------------------------------------------ */

  ed.readImage = function (file, max, quality) {
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) { rej(new Error('Lütfen bir görsel dosyası seçin.')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        var c = doc.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', quality || 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Görsel okunamadı.')); };
      img.src = url;
    });
  };

  ed.readFile = function (file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(file);
    });
  };

  function handleUpload(el) {
    var files = Array.prototype.slice.call(el.files || []);
    if (!files.length) return;
    var kind = el.getAttribute('data-upload');
    var path = el.getAttribute('data-path');
    el.value = '';
    if (kind === 'audio') {
      var f = files[0];
      if (f.size > 6 * 1024 * 1024) { ed.toast('Müzik dosyası 6 MB\'tan küçük olmalı. Daha kısa/düşük kaliteli bir mp3 deneyin.', 'err'); return; }
      ed.readFile(f).then(function (d) {
        DV.set(ed.state, path, d);
        if (!ed.state.music.title) ed.state.music.title = f.name.replace(/\.[^.]+$/, '');
        ed.changed({ rerender: true });
        ed.toast('Müzik eklendi');
      });
      return;
    }
    var max = parseInt(el.getAttribute('data-max'), 10) || 1600;
    ed.toast('Fotoğraf hazırlanıyor…');
    Promise.all(files.map(function (f) { return ed.readImage(f, max, 0.82); })).then(function (urls) {
      if (kind === 'gallery') {
        urls.forEach(function (u) { ed.state.gallery.push({ src: u, caption: '' }); });
      } else {
        DV.set(ed.state, path, urls[0]);
      }
      ed.changed({ rerender: true });
      ed.toast(urls.length > 1 ? urls.length + ' fotoğraf eklendi' : 'Fotoğraf eklendi');
    }).catch(function (err) { ed.toast(err.message, 'err'); });
  }

  /** Görsel alanı (yükle / bağlantı / kaldır) */
  ed.imageField = function (path, o) {
    o = o || {};
    var v = DV.get(ed.state, path) || '';
    var src = DV.safeUrl(v, 'image');
    return '<div class="imgf">' +
      '<div class="imgf-prev">' + (src ? '<img src="' + esc(src) + '" alt="">' : DV.icon('camera')) + '</div>' +
      '<div class="imgf-c">' +
      '<div class="btns"><label class="btn-s primary">' + DV.icon('download', 'rot180') + ' Fotoğraf yükle<input type="file" accept="image/*" hidden data-upload="image" data-path="' + path + '" data-max="' + (o.max || 1600) + '"></label>' +
      (v ? '<button type="button" class="btn-s" data-action="clear-path" data-path="' + path + '">' + DV.icon('x') + ' Kaldır</button>' : '') + '</div>' +
      '<input type="url" class="sm" placeholder="veya görsel bağlantısı yapıştırın (https://...)" data-url-for="' + path + '">' +
      (DV.isDataUrl(v) ? '<p class="hint">Cihazdan yüklendi (' + Math.round(v.length * 0.75 / 1024) + ' KB). Paylaşım bağlantısına sığmadığı için yalnızca "Tek dosya HTML" ve "JSON" yöntemlerinde yer alır.</p>' : '') +
      (o.extra || '') +
      '</div></div>';
  };

  /* ------------------------------------------------------------------ *
   *  Sekmeler
   * ------------------------------------------------------------------ */

  ed.tab = function (id, def) {
    ed.tabs[id] = def;
    ed.order.push(id);
  };

  ed.render = function (keepScroll) {
    var tab = ed.tabs[ed.ui.tab] || ed.tabs[ed.order[0]];
    var panel = $('#panel');
    var y = panel.scrollTop;
    fid = 0;
    panel.innerHTML =
      '<div class="pn-head"><h2>' + esc(tab.title || tab.label) + '</h2>' + (tab.desc ? '<p>' + tab.desc + '</p>' : '') + '</div>' +
      tab.render() +
      '<div class="pn-foot">' + navButtons() + '</div>';
    hydrate(panel);
    if (tab.after) tab.after(panel);
    panel.scrollTop = keepScroll ? y : 0;
    ed.$$('#nav [data-tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === ed.ui.tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  };

  function navButtons() {
    var i = ed.order.indexOf(ed.ui.tab);
    var prev = ed.order[i - 1], next = ed.order[i + 1];
    return (prev ? '<button type="button" class="btn-s" data-action="goto" data-tab="' + prev + '">' + DV.icon('left') + ' ' + esc(ed.tabs[prev].label) + '</button>' : '<span></span>') +
      (next ? '<button type="button" class="btn-s primary" data-action="goto" data-tab="' + next + '">' + esc(ed.tabs[next].label) + ' ' + DV.icon('right') + '</button>' : '');
  }

  ed.go = function (id) {
    if (!ed.tabs[id]) return;
    ed.ui.tab = id;
    try { sessionStorage.setItem('dv:tab', id); } catch (e) { /* yoksay */ }
    ed.render();
    if (ed.tabs[id].section) ed.scrollPreview(ed.tabs[id].section);
    doc.body.classList.remove('pv-open');
  };

  function renderNav() {
    $('#nav').innerHTML = ed.order.map(function (id, i) {
      var t = ed.tabs[id];
      return '<button type="button" data-action="goto" data-tab="' + id + '">' + DV.icon(t.icon) + '<span>' + esc(t.label) + '</span></button>';
    }).join('');
  }

  /* ------------------------------------------------------------------ *
   *  Bildirim & pencere
   * ------------------------------------------------------------------ */

  var toastT;
  ed.toast = function (msg, kind) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'ed-toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.className = 'ed-toast'; }, kind === 'err' ? 4200 : 2200);
  };

  /**
   * Basit modal. actions: [{label, primary, danger, value}]
   * Döner: Promise<value> (kapatılırsa null)
   */
  ed.modal = function (o) {
    return new Promise(function (resolve) {
      var m = doc.createElement('div');
      m.className = 'modal-bg';
      m.innerHTML = '<div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '">' +
        '<header class="modal-h"><h3>' + esc(o.title || '') + '</h3><button type="button" class="ib" data-close aria-label="Kapat">' + DV.icon('x') + '</button></header>' +
        '<div class="modal-b">' + (o.body || '') + '</div>' +
        ((o.actions || []).length ? '<footer class="modal-f">' + o.actions.map(function (a, i) {
          return '<button type="button" class="btn-s' + (a.primary ? ' primary' : '') + (a.danger ? ' danger' : '') + '" data-mi="' + i + '">' + esc(a.label) + '</button>';
        }).join('') + '</footer>' : '') +
        '</div>';
      doc.body.appendChild(m);
      var close = function (val) {
        doc.removeEventListener('keydown', onKey);
        m.remove();
        resolve(val === undefined ? null : val);
      };
      var onKey = function (e) { if (e.key === 'Escape') close(null); };
      doc.addEventListener('keydown', onKey);
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('[data-close]')) { close(null); return; }
        var b = e.target.closest('[data-mi]');
        if (!b) return;
        var a = o.actions[+b.getAttribute('data-mi')];
        if (a.onClick) {
          var r = a.onClick(m);
          if (r === false) return;
        }
        close(a.value !== undefined ? a.value : a.label);
      });
      if (o.onOpen) o.onOpen(m, close);
      var first = m.querySelector('.modal-f .primary') || m.querySelector('[data-close]');
      if (first && !o.noAutofocus) first.focus();
    });
  };

  ed.confirm = function (msg, okLabel, danger) {
    return ed.modal({
      title: 'Emin misiniz?',
      body: '<p>' + msg + '</p>',
      actions: [{ label: 'Vazgeç', value: false }, { label: okLabel || 'Devam et', primary: !danger, danger: !!danger, value: true }]
    }).then(function (v) { return v === true; });
  };

  ed.download = function (name, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  ed.copy = function (text, msg) {
    var done = function () { ed.toast(msg || 'Kopyalandı'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-200px;opacity:0';
      doc.body.appendChild(ta);
      ta.select();
      try { doc.execCommand('copy'); done(); } catch (e) { ed.toast('Kopyalanamadı', 'err'); }
      ta.remove();
    }
  };

  /* ------------------------------------------------------------------ *
   *  Ortak eylemler
   * ------------------------------------------------------------------ */

  var A = ed.actions;

  A.goto = function (el) { ed.go(el.getAttribute('data-tab')); };

  A['clear-path'] = function (el) {
    DV.set(ed.state, el.getAttribute('data-path'), '');
    ed.changed({ rerender: true });
  };

  function listOf(el) { return DV.get(ed.state, el.getAttribute('data-path')); }

  A['list-up'] = function (el) {
    var a = listOf(el), i = +el.getAttribute('data-i');
    if (i <= 0) return;
    a.splice(i - 1, 0, a.splice(i, 1)[0]);
    ed.changed({ rerender: true });
  };
  A['list-down'] = function (el) {
    var a = listOf(el), i = +el.getAttribute('data-i');
    if (i >= a.length - 1) return;
    a.splice(i + 1, 0, a.splice(i, 1)[0]);
    ed.changed({ rerender: true });
  };
  A['list-del'] = function (el) {
    var a = listOf(el), i = +el.getAttribute('data-i');
    a.splice(i, 1);
    ed.changed({ rerender: true });
  };
  A['list-add'] = function (el) {
    var a = listOf(el);
    var kind = el.getAttribute('data-kind');
    a.push(ed.blank[kind] ? ed.blank[kind]() : {});
    ed.changed({ rerender: true });
    setTimeout(function () {
      var items = ed.$$('[data-list="' + el.getAttribute('data-path') + '"] > .item');
      var last = items[items.length - 1];
      if (last) { ed.scrollPanelTo(last, 'center'); var inp = last.querySelector('input,textarea'); if (inp) inp.focus({ preventScroll: true }); }
    }, 30);
  };

  ed.blank = {
    story: function () { return { date: '', title: '', text: '' }; },
    info: function () { return { icon: 'info', title: '', text: '', link: '', linkText: '' }; },
    contact: function () { return { name: '', role: '', phone: '' }; },
    account: function () { return { bank: '', holder: '', iban: '' }; },
    guest: function () { return { id: DV.uid('g'), name: '', group: '', phone: '', note: '' }; }
  };

  A['pv-device'] = function (el) {
    ed.ui.device = el.getAttribute('data-device');
    ed.$$('[data-action="pv-device"]').forEach(function (b) { b.classList.toggle('active', b === el); });
    fitPreview();
  };
  A['pv-envelope'] = function () {
    if (!ed.state.design.envelope) { ed.toast('Zarf animasyonu kapalı. Tasarım sekmesinden açabilirsiniz.'); return; }
    ed.renderPreview(true);
    doc.body.classList.add('pv-open');
  };
  A['pv-open'] = function () {
    doc.body.classList.add('pv-open');
    setTimeout(fitPreview, 30);
  };
  A['pv-close'] = function () { doc.body.classList.remove('pv-open'); };

  /* ------------------------------------------------------------------ *
   *  Başlat
   * ------------------------------------------------------------------ */

  function renderPvGroups() {
    var sel = $('#pvGroup');
    if (!sel) return;
    var groups = ed.state.guests.groups;
    sel.innerHTML = '<option value="*">Tüm etkinlikler</option><option value="">Genel bağlantı</option>' +
      groups.map(function (g) { return '<option value="' + esc(g.id) + '">Grup: ' + esc(g.name) + '</option>'; }).join('');
    sel.value = ed.ui.pvGroup;
    if (sel.value !== ed.ui.pvGroup) { ed.ui.pvGroup = '*'; sel.value = '*'; }
  }
  ed.renderPvGroups = renderPvGroups;

  ed.start = function () {
    renderNav();
    doc.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      var fn = A[el.getAttribute('data-action')];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    var panel = $('#panel');
    panel.addEventListener('input', onInput);
    panel.addEventListener('change', onInput);

    $('#pvGroup').addEventListener('change', function (e) { ed.ui.pvGroup = e.target.value; ed.renderPreview(false); });
    $('#pvGuest').addEventListener('input', DV.debounce(function (e) { ed.ui.pvGuest = e.target.value.trim(); ed.renderPreview(false); }, 300));

    window.addEventListener('resize', DV.debounce(fitPreview, 100));
    doc.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (A['project-save']) A['project-save']();
      }
    });

    try { var t = sessionStorage.getItem('dv:tab'); if (t && ed.tabs[t]) ed.ui.tab = t; } catch (e) { /* yoksay */ }

    ed.store.get('project').then(function (saved) {
      var first = !saved;
      ed.state = DV.normalize(saved || DV.sample());
      ed.render();
      renderPvGroups();
      fitPreview();
      setStatus('saved');
      if (first) {
        ed.store.set('project', ed.state);
        ed.toast('Örnek davetiye ile başladınız — dilediğiniz gibi değiştirin.');
      }
      $('#pv').src = 'davetiye.html?preview=1';
    });
  };
})();
