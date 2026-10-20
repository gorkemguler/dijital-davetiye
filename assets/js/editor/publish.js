/*!
 * Dijital Davetiye — misafirler & yayınlama
 * Kişiye özel bağlantılar, paylaşım linki, tek dosya HTML, JSON, QR kod, proje dosyası
 * MIT Lisansı
 */
(function () {
  'use strict';

  var DV = window.DV, ed = DV.ed, esc = DV.esc, F = ed.f, A = ed.actions, icon = DV.icon, card = ed.card;

  function S() { return ed.state; }

  /* ================================================================== *
   *  Bağlantı üretimi
   * ================================================================== */

  ed.siteBase = function () {
    var b = String(S().publish.baseUrl || (window.DV_SITE && window.DV_SITE.baseUrl) || '').trim();
    if (!b && /^https?:$/.test(location.protocol)) b = new URL('.', location.href).href;
    if (b && !/\/$/.test(b)) b += '/';
    return b;
  };

  ed.isLocalBase = function (b) {
    return !b || /^file:/i.test(b) || /\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/i.test(b);
  };

  ed.slug = function () {
    return DV.slugify(S().publish.slug) || DV.slugify(DV.coupleNames(S(), ' ')) || 'davetiye';
  };

  var cache = { key: '', code: '' };
  ed.shareCode = function () {
    var sd = DV.shareData(S());
    var key = JSON.stringify(sd.data);
    if (cache.key === key) return Promise.resolve({ code: cache.code, stripped: sd.stripped });
    return DV.codec.encode(sd.data).then(function (code) {
      cache = { key: key, code: code };
      return { code: code, stripped: sd.stripped };
    });
  };

  function guestQuery(g) {
    var q = [];
    if (g && g.name) q.push('to=' + encodeURIComponent(g.name.trim()));
    if (g && g.group) q.push('g=' + encodeURIComponent(g.group));
    return q;
  }

  /** Verinin bağlantının içinde taşındığı paylaşım linki. */
  ed.shareLink = function (guest) {
    var q = guestQuery(guest);
    return ed.shareCode().then(function (r) {
      return ed.siteBase() + 'davetiye.html' + (q.length ? '?' + q.join('&') : '') + '#' + r.code;
    });
  };

  /** Davetiye bağlantısı (misafir verilirse kişiye özel) — seçili yönteme göre. */
  ed.inviteLink = function (guest) {
    var mode = S().publish.mode;
    var q = guestQuery(guest);
    if (mode === 'custom') {
      var u = String(S().publish.customUrl || '').trim();
      if (!u) return Promise.reject(new Error('Önce Misafirler sekmesinde davetiyenizin adresini yazın.'));
      return Promise.resolve(u + (q.length ? (u.indexOf('?') >= 0 ? '&' : '?') + q.join('&') : ''));
    }
    if (mode === 'json') {
      return Promise.resolve(ed.siteBase() + 'davetiye.html?' + ['d=' + encodeURIComponent(ed.slug())].concat(q).join('&'));
    }
    return ed.shareLink(guest);
  };

  function guestMessage(g, link) {
    var tpl = S().guests.message || 'Merhaba {isim}! Düğünümüze davetlisiniz 💍 Davetiyeniz: {link}';
    return tpl.split('{isim}').join(g.name || '').split('{link}').join(link);
  }

  /* ================================================================== *
   *  8) Misafirler
   * ================================================================== */

  ed.tab('misafirler', {
    label: 'Misafirler', icon: 'users', title: 'Misafirler & özel bağlantılar', section: 'hero',
    desc: 'Her misafire adıyla seslenen bir davetiye bağlantısı oluşturun. Zarfın üstünde "Sevgili Ahmet Bey" yazar. Misafir listesi yalnızca sizin tarayıcınızda/proje dosyanızda tutulur, davetiyeye eklenmez.',
    render: function () {
      var s = S(), g = s.guests;
      var mode = s.publish.mode;

      var groups = (g.groups.length
        ? '<div class="list">' + g.groups.map(function (gr, i) {
          var used = s.events.filter(function (e) { return e.groups.indexOf(gr.id) >= 0; }).map(function (e) { return DV.eventName(e, 'tr'); });
          return '<div class="item"><div class="item-b"><div class="row">' + F.text('guests.groups.' + i + '.name', 'Grup adı', { maxlength: 30 }) +
            '<div class="fld"><label>Bağlantıda</label><code class="pill">g=' + esc(gr.id) + '</code></div></div>' +
            '<p class="hint">' + (used.length ? 'Özel etkinlikler: ' + used.map(esc).join(', ') : 'Bu gruba özel etkinlik yok — herkesle aynı davetiyeyi görür.') + '</p></div>' +
            '<div class="it-tools"><button type="button" class="ib danger" data-action="group-del" data-i="' + i + '" title="Grubu sil">' + icon('x') + '</button></div></div>';
        }).join('') + '</div>'
        : '<p class="empty-s">Henüz grup yok. Ör: Aile, Arkadaşlar, İş arkadaşları.</p>') +
        '<div class="inline-add"><input type="text" class="sm" id="newGroup" maxlength="30" placeholder="Yeni grup adı"><button type="button" class="btn-s" data-action="group-add">+ Grup ekle</button></div>';

      var groupOpts = [['', 'Genel']].concat(g.groups.map(function (x) { return [x.id, x.name]; }));
      var list = g.list.length
        ? '<div class="list guests" data-list="guests.list">' + g.list.map(function (gu, i) {
          return '<div class="item"><div class="item-b"><div class="row3">' +
            F.text('guests.list.' + i + '.name', 'Ad', { placeholder: 'Ahmet Bey ve Ailesi', maxlength: 80 }) +
            F.select('guests.list.' + i + '.group', 'Grup', groupOpts) +
            F.text('guests.list.' + i + '.phone', 'Telefon', { placeholder: '0532…', inputmode: 'tel', optional: true }) +
            '</div><div class="btns sm">' +
            '<button type="button" class="btn-s" data-action="guest-wa" data-i="' + i + '">' + icon('chat') + ' WhatsApp</button>' +
            '<button type="button" class="btn-s" data-action="guest-copy" data-i="' + i + '">' + icon('copy') + ' Bağlantı</button>' +
            '<button type="button" class="btn-s" data-action="guest-open" data-i="' + i + '">' + icon('link') + ' Aç</button>' +
            '<button type="button" class="btn-s" data-action="guest-preview" data-i="' + i + '">' + icon('play') + ' Önizle</button>' +
            '</div></div>' + ed.itemTools('guests.list', i, g.list.length) + '</div>';
        }).join('') + '</div>'
        : '<p class="empty-s">Henüz misafir eklenmedi.</p>';

      var bulk =
        '<div class="fld"><label for="bulk">Toplu ekle</label><textarea id="bulk" rows="3" placeholder="Her satıra bir misafir:\nAhmet Bey ve Ailesi, 0532 111 22 33\nSelin Kaya"></textarea>' +
        '<div class="inline-add"><select id="bulkGroup" class="sm">' + groupOpts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="btn-s" data-action="guest-bulk">Listeye ekle</button></div></div>';

      var base = ed.siteBase();
      var warn = mode !== 'custom' && ed.isLocalBase(base)
        ? '<p class="note warn">' + icon('info') + ' Editörü kendi bilgisayarınızda açtığınız için bağlantılar başkalarında çalışmaz. <a href="#" data-action="goto" data-tab="yayinla">Yayınla</a> sekmesinden site adresinizi girin.</p>' : '';

      return card('Bağlantı türü',
        F.select('publish.mode', 'Misafir bağlantıları nasıl oluşturulsun?', [
          ['link', 'Paylaşım bağlantısı (bilgiler linkin içinde)'],
          ['json', 'GitHub deposundaki JSON dosyası (?d=' + ed.slug() + ')'],
          ['custom', 'Kendi adresim (tek dosya HTML vb.)']
        ], { rerender: true }) +
        (mode === 'custom' ? F.text('publish.customUrl', 'Davetiyenizin adresi', { type: 'url', placeholder: 'https://elif-can.netlify.app/' }) : '') + warn,
        { icon: 'link' }) +
        card('Misafir grupları', groups, { icon: 'users', desc: 'Gruplar, bazı etkinlikleri yalnızca belirli misafirlere göstermenizi sağlar (ör. kına gecesi yalnızca Aile, after party yalnızca Arkadaşlar). Etkinlikler sekmesinde "Kimler görsün?" kısmından seçin.' }) +
        card('Misafir listesi (' + g.list.length + ')',
          list +
          '<button type="button" class="btn-s add" data-action="list-add" data-path="guests.list" data-kind="guest">+ Misafir ekle</button>' + bulk +
          '<div class="btns"><button type="button" class="btn-s" data-action="guest-csv">' + icon('download') + ' Liste + bağlantılar (CSV / Excel)</button></div>',
          { icon: 'heart' }) +
        card('Davet mesajı',
          F.area('guests.message', 'WhatsApp mesaj şablonu', { rows: 3, placeholder: 'Merhaba {isim}! Düğünümüze davetlisiniz 💍 Davetiyeniz: {link}', hint: '<code>{isim}</code> misafirin adıyla, <code>{link}</code> kişiye özel bağlantıyla değişir.' }),
          { icon: 'chat' });
    }
  });

  A['group-add'] = function () {
    var inp = ed.$('#newGroup');
    var name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    var groups = S().guests.groups;
    var base = DV.slugify(name) || 'grup', id = base, n = 2;
    while (groups.some(function (g) { return g.id === id; })) id = base + '-' + n++;
    groups.push({ id: id, name: name });
    ed.changed({ rerender: true });
    ed.renderPvGroups();
  };

  A['group-del'] = function (el) {
    var i = +el.getAttribute('data-i');
    var gr = S().guests.groups[i];
    ed.confirm('"' + esc(gr.name) + '" grubu silinecek. Bu gruptaki misafirler "Genel" olur, etkinliklerdeki grup kısıtlaması kaldırılır.', 'Sil', true).then(function (ok) {
      if (!ok) return;
      S().guests.groups.splice(i, 1);
      S().events.forEach(function (e) { e.groups = e.groups.filter(function (x) { return x !== gr.id; }); });
      S().guests.list.forEach(function (g) { if (g.group === gr.id) g.group = ''; });
      ed.changed({ rerender: true });
      ed.renderPvGroups();
    });
  };

  A['guest-bulk'] = function () {
    var ta = ed.$('#bulk');
    var group = ed.$('#bulkGroup').value;
    var lines = ta.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) { ta.focus(); return; }
    lines.forEach(function (l) {
      var parts = l.split(/\s*[,;\t]\s*/);
      var phone = '', name = [];
      parts.forEach(function (p) { if (/^[+\d][\d\s()-]{6,}$/.test(p)) phone = p; else if (p) name.push(p); });
      S().guests.list.push({ id: DV.uid('g'), name: name.join(' ') || l, group: group, phone: phone, note: '' });
    });
    ed.changed({ rerender: true });
    ed.toast(lines.length + ' misafir eklendi');
  };

  function guestAt(el) { return S().guests.list[+el.getAttribute('data-i')]; }

  function withLink(g, fn) {
    if (!g.name) { ed.toast('Önce misafirin adını yazın', 'err'); return; }
    ed.inviteLink(g).then(fn).catch(function (e) { ed.toast(e.message, 'err'); });
  }

  A['guest-copy'] = function (el) { var g = guestAt(el); withLink(g, function (l) { ed.copy(l, g.name + ' için bağlantı kopyalandı'); }); };
  A['guest-open'] = function (el) {
    var g = guestAt(el);
    var w = window.open('about:blank', '_blank');
    withLink(g, function (l) { if (w) w.location.href = l; else location.href = l; });
  };
  A['guest-wa'] = function (el) {
    var g = guestAt(el);
    var w = window.open('about:blank', '_blank');
    withLink(g, function (l) {
      var url = DV.links.whatsapp(g.phone || '', guestMessage(g, l));
      if (w) w.location.href = url; else location.href = url;
    });
  };
  A['guest-preview'] = function (el) {
    var g = guestAt(el);
    ed.ui.pvGuest = g.name;
    ed.ui.pvGroup = g.group || '';
    ed.$('#pvGuest').value = g.name;
    ed.renderPvGroups();
    ed.renderPreview(true);
    document.body.classList.add('pv-open');
  };

  A['guest-csv'] = function () {
    var list = S().guests.list.filter(function (g) { return g.name; });
    if (!list.length) { ed.toast('Listede misafir yok', 'err'); return; }
    var gname = function (id) { var x = S().guests.groups.filter(function (g) { return g.id === id; })[0]; return x ? x.name : 'Genel'; };
    Promise.all(list.map(function (g) { return ed.inviteLink(g); })).then(function (links) {
      var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var rows = [['Ad', 'Grup', 'Telefon', 'Bağlantı', 'Mesaj'].map(q).join(';')];
      list.forEach(function (g, i) { rows.push([g.name, gname(g.group), g.phone, links[i], guestMessage(g, links[i])].map(q).join(';')); });
      ed.download('misafir-listesi-' + ed.slug() + '.csv', '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    }).catch(function (e) { ed.toast(e.message, 'err'); });
  };

  /* ================================================================== *
   *  9) Yayınla
   * ================================================================== */

  ed.issues = function () {
    var s = S(), out = [];
    if (!s.couple.bride.name || !s.couple.groom.name) out.push({ lvl: 'err', text: 'Gelin ve damadın adlarını girin.', tab: 'cift' });
    if (!s.events.length) out.push({ lvl: 'err', text: 'En az bir etkinlik ekleyin.', tab: 'etkinlikler' });
    s.events.forEach(function (ev) {
      var n = '"' + DV.eventName(ev, 'tr') + '"';
      if (!ev.date) out.push({ lvl: 'warn', text: n + ' için tarih seçilmedi.', tab: 'etkinlikler', ev: ev.id });
      else if (!ev.start) out.push({ lvl: 'info', text: n + ' için saat girilmedi (tüm gün olarak görünür).', tab: 'etkinlikler', ev: ev.id });
      if (!DV.hasCoords(ev) && !ev.address && !ev.venue) out.push({ lvl: 'warn', text: n + ' için mekan / adres yok.', tab: 'etkinlikler', ev: ev.id });
      else if (!DV.hasCoords(ev)) out.push({ lvl: 'info', text: n + ' için haritadan konum seçilmedi; yol tarifi adres metniyle yapılır.', tab: 'etkinlikler', ev: ev.id });
    });
    var r = s.rsvp;
    if (r.method === 'whatsapp' && DV.phoneIntl(r.whatsapp).length < 10) out.push({ lvl: 'err', text: 'LCV için WhatsApp numarası girin.', tab: 'lcv' });
    if (r.method === 'email' && !/@/.test(r.email)) out.push({ lvl: 'err', text: 'LCV için e-posta adresi girin.', tab: 'lcv' });
    if ((r.method === 'sheets' || r.method === 'formspree') && !/^https:\/\//i.test(r.endpoint)) out.push({ lvl: 'err', text: 'LCV form adresi (https://…) eksik.', tab: 'lcv' });
    if (r.method === 'link' && !DV.safeUrl(r.formUrl, 'link')) out.push({ lvl: 'err', text: 'LCV form bağlantısı eksik.', tab: 'lcv' });
    var main = DV.mainEvent(s.events);
    if (r.deadline && main && main.date && r.deadline > main.date) out.push({ lvl: 'warn', text: 'LCV son tarihi ana etkinlikten sonra görünüyor.', tab: 'lcv' });
    return out;
  };

  A['issue-go'] = function (el) {
    var ev = el.getAttribute('data-ev');
    if (ev) ed.ui.openEvent = ev;
    ed.go(el.getAttribute('data-tab'));
  };

  ed.tab('yayinla', {
    label: 'Yayınla', icon: 'share', title: 'Yayınla & paylaş', section: 'hero',
    desc: 'Davetiyenizi üç farklı yolla yayınlayabilirsiniz. Hepsi ücretsizdir ve sunucu kurmanız gerekmez.',
    render: function () {
      var s = S();
      var issues = ed.issues();
      var lvlIcon = { err: 'x', warn: 'info', info: 'info' };
      var check = issues.length
        ? '<ul class="issues">' + issues.map(function (x) {
          return '<li class="' + x.lvl + '"><button type="button" data-action="issue-go" data-tab="' + x.tab + '"' + (x.ev ? ' data-ev="' + esc(x.ev) + '"' : '') + '>' + icon(lvlIcon[x.lvl]) + '<span>' + esc(x.text) + '</span>' + icon('right', 'go') + '</button></li>';
        }).join('') + '</ul>'
        : '<p class="note ok">' + icon('check') + ' Her şey hazır görünüyor!</p>';

      var base = ed.siteBase();
      var local = ed.isLocalBase(base);
      var site = F.text('publish.baseUrl', 'Sitenizin adresi', {
        type: 'url',
        placeholder: base && !local ? base : 'https://kullaniciadi.github.io/dijital-davetiye/',
        hint: local
          ? '<b class="warn-t">Editör şu an yerel bilgisayarınızda açık; oluşturulan bağlantılar başkalarında açılmaz.</b> Projeyi GitHub Pages\'te yayınlayıp adresini buraya yazın (README\'de adım adım anlatılıyor).'
          : 'Bağlantılar şu adrese göre oluşturulur: <code>' + esc(base) + '</code>'
      });

      var m1 =
        '<div class="btns"><button type="button" class="btn-s primary" data-action="make-link">' + icon('link') + ' Bağlantıyı oluştur</button></div><div id="linkOut"></div>';

      var m2 =
        '<div class="btns"><button type="button" class="btn-s primary" data-action="export-html">' + icon('download') + ' ' + esc(ed.slug()) + '.html indir</button></div>' +
        '<ol class="guide sm"><li>Dosyayı <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">Netlify Drop</a>\'a sürükleyin <i>veya</i> GitHub deponuza yükleyin.</li><li>Verilen adresi misafirlerinize gönderin. Misafire özel bağlantı için sonuna <code>?to=Ahmet%20Bey</code> ekleyin.</li></ol>';

      var slug = ed.slug();
      var repoLink = base + 'davetiye.html?d=' + slug;
      var m3 =
        F.text('publish.slug', 'Dosya adı', { placeholder: slug, hint: 'Sadece küçük harf, rakam ve tire. Bağlantıda görünür.' }) +
        '<div class="btns"><button type="button" class="btn-s primary" data-action="export-json">' + icon('download') + ' ' + esc(slug) + '.json indir</button></div>' +
        '<ol class="guide sm">' +
        '<li>İndirdiğiniz dosyayı GitHub deponuzdaki <code>invitations/</code> klasörüne yükleyin (GitHub\'da <i>Add file → Upload files</i>).</li>' +
        '<li>Birkaç dakika içinde davetiyeniz şu adreste yayında olur:<br><code class="break">' + esc(repoLink) + '</code></li>' +
        '<li>İsterseniz <code>site.config.js</code> içinde <code>home: \'invite\'</code> ve <code>defaultInvitation: \'' + esc(slug) + '\'</code> yaparak davetiyeyi doğrudan ana sayfada açın.</li>' +
        '</ol>' +
        '<p class="hint">Fotoğrafları JSON\'a gömmek yerine <code>invitations/img/</code> klasörüne yükleyip <code>invitations/img/kapak.jpg</code> gibi bağlantı vermeniz dosyayı küçültür.</p>';

      var proj =
        '<div class="btns"><button type="button" class="btn-s" data-action="project-save">' + icon('download') + ' Proje dosyasını kaydet</button>' +
        '<button type="button" class="btn-s" data-action="project-open">' + icon('download', 'rot180') + ' Proje dosyası aç</button></div>';

      return card('Kontrol listesi', check, { icon: 'check' }) +
        card('Site adresi', site, { icon: 'link' }) +
        card('Yöntem 1 · Paylaşım bağlantısı', m1, { icon: 'share', cls: 'method', desc: '<b>En kolayı.</b> Tüm davetiye bilgileri bağlantının içine sıkıştırılır; hiçbir dosya yüklemeniz gerekmez. Bağlantıyı WhatsApp\'tan gönderin veya QR kod olarak basılı davetiyeye ekleyin.' }) +
        card('Yöntem 2 · Tek dosya HTML', m2, { icon: 'download', cls: 'method', desc: 'Fotoğraflar ve müzik dahil her şey tek bir dosyada. İstediğiniz yere yükleyin; WhatsApp önizlemesinde çift adı ve tarih görünür.' }) +
        card('Yöntem 3 · GitHub deposuna JSON', m3, { icon: 'book', cls: 'method', desc: 'Kısa ve şık bağlantı (<code>?d=' + esc(slug) + '</code>). Davetiyeyi sonradan güncellemek için dosyayı değiştirmeniz yeterli; bağlantı aynı kalır.' }) +
        card('Proje dosyası', proj, { icon: 'heart', desc: 'Tüm ayarlarınızı (misafir listesi dahil) yedekleyin veya başka bir bilgisayarda açın. Kısayol: Ctrl/Cmd + S' });
    }
  });

  A['make-link'] = function () {
    var out = ed.$('#linkOut');
    ed.shareLink(null).then(function (link) {
      return ed.shareCode().then(function (r) {
        var local = ed.isLocalBase(ed.siteBase());
        out.innerHTML =
          '<div class="link-out">' +
          '<textarea readonly rows="3" class="sm mono" id="shareLink">' + esc(link) + '</textarea>' +
          '<p class="hint">' + link.length + ' karakter' + (r.stripped.length ? ' · <b class="warn-t">Bağlantıya dahil edilmedi: ' + r.stripped.map(esc).join(', ') + '</b> (cihazdan yüklenen dosyalar linke sığmaz — görsel bağlantısı kullanın veya Yöntem 2/3\'ü seçin)' : '') + '</p>' +
          (local ? '<p class="note warn">' + icon('info') + ' Bu bağlantı yerel adres içeriyor; yalnızca sizin bilgisayarınızda açılır.</p>' : '') +
          '<div class="btns">' +
          '<button type="button" class="btn-s primary" data-action="link-copy">' + icon('copy') + ' Kopyala</button>' +
          '<a class="btn-s" href="' + esc(link) + '" target="_blank" rel="noopener">' + icon('link') + ' Aç</a>' +
          '<a class="btn-s" href="' + esc(DV.links.whatsapp('', (DV.coupleNames(S()) || '') + ' — ' + DV.t(S().lang, 'kicker') + ' 💍\n' + link)) + '" target="_blank" rel="noopener">' + icon('chat') + ' WhatsApp</a>' +
          '<button type="button" class="btn-s" data-action="link-qr">' + icon('camera') + ' QR kod</button>' +
          '</div></div>';
      });
    }).catch(function (e) {
      ed.toast(e.message, 'err');
    });
  };

  A['link-copy'] = function () { ed.copy(ed.$('#shareLink').value, 'Bağlantı kopyalandı'); };
  A['link-qr'] = function () { ed.showQr(ed.$('#shareLink').value); };

  /* ---------- QR kod ---------- */

  ed.showQr = function (text) {
    DV.loadScript(DV.LIBS.qrcode).then(function () {
      var qr = null;
      ['M', 'L'].some(function (lvl) {
        try { var q = window.qrcode(0, lvl); q.addData(text); q.make(); qr = q; return true; } catch (e) { return false; }
      });
      if (!qr) {
        ed.toast('Bağlantı QR koda sığmayacak kadar uzun. Yöntem 3 (JSON) ile kısa bağlantı oluşturun.', 'err');
        return;
      }
      var n = qr.getModuleCount(), cell = Math.max(4, Math.floor(1000 / (n + 8))), margin = cell * 4;
      var c = document.createElement('canvas');
      c.width = c.height = n * cell + margin * 2;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#111';
      for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect(margin + k * cell, margin + r * cell, cell, cell);
      var url = c.toDataURL('image/png');
      ed.modal({
        title: 'QR kod',
        body: '<div class="qr"><img src="' + url + '" alt="Davetiye QR kodu"><p class="hint">Basılı davetiyelere ekleyebilirsiniz. ' + (n > 60 ? '<b class="warn-t">Bağlantı uzun olduğu için QR kod yoğun; en az 3 cm basın veya kısa bağlantı (JSON) kullanın.</b>' : '') + '</p></div>',
        actions: [{ label: 'PNG indir', primary: true, onClick: function () { var a = document.createElement('a'); a.href = url; a.download = 'davetiye-qr-' + ed.slug() + '.png'; a.click(); return false; } }, { label: 'Kapat' }]
      });
    }).catch(function () { ed.toast('QR kütüphanesi yüklenemedi (internet bağlantısı?)', 'err'); });
  };

  /* ---------- Tek dosya HTML ---------- */

  ed.buildStandalone = function () {
    var data = DV.inviteData(DV.normalize(S()));
    var R = DV.resolveDesign(data);
    var files = ['assets/css/invite.css', 'templates/' + R.tpl.id + '.css', 'assets/js/core.js', 'assets/js/templates.js', 'assets/js/invite.js'];
    return Promise.all(files.map(function (f) {
      return fetch(f, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(f + ' okunamadı (' + r.status + ')');
        return r.text();
      });
    })).then(function (t) {
      var lang = data.lang;
      var names = DV.coupleNames(data) || 'Düğün Davetiyesi';
      var main = DV.mainEvent(data.events);
      var title = names + ' — ' + (data.texts.kicker || DV.t(lang, 'kicker'));
      var desc = [main && main.date ? DV.dt.formatDate(lang, main.date) : '', DV.cities(data.events).join(' · ')].filter(Boolean).join(' · ') || DV.t(lang, 'intro');
      var img = /^https?:\/\//i.test(data.couple.photo) ? data.couple.photo : '';
      var json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, function (c) { return '\\u' + c.charCodeAt(0).toString(16); });
      var site = JSON.stringify({ repoUrl: (window.DV_SITE && window.DV_SITE.repoUrl) || '' });
      var endScript = '</' + 'script>';
      var safe = function (s) { return s.replace(/<\/script/gi, '<\\/script'); };
      var fonts = [R.fonts.script, R.fonts.heading, R.fonts.body].filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      var favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='88'%3E%F0%9F%92%8C%3C/text%3E%3C/svg%3E";

      return '<!doctype html>\n<html lang="' + lang + '">\n<head>\n' +
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
        '<meta name="robots" content="noindex, nofollow">\n' +
        '<title>' + esc(title) + '</title>\n' +
        '<meta name="description" content="' + esc(desc) + '">\n' +
        '<meta property="og:type" content="website">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n' +
        (img ? '<meta property="og:image" content="' + esc(img) + '">\n' : '') +
        '<meta name="theme-color" content="' + esc(R.colors.bg) + '">\n' +
        '<link rel="icon" href="' + favicon + '">\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
        fonts.map(function (f) { return '<link rel="stylesheet" href="' + esc(DV.fontHref(f)) + '" data-font="' + esc(f) + '">'; }).join('\n') + '\n' +
        '<style>\n' + t[0] + '\n' + t[1] + '\n</style>\n</head>\n<body class="dv">\n' +
        '<main id="app" class="inv"><div class="dv-loading"><span></span></div></main>\n' +
        '<script>window.DV_EMBEDDED=true;window.DV_SITE=' + site + ';window.DV_DATA=' + json + ';' + endScript + '\n' +
        '<script>\n' + safe(t[2]) + '\n' + endScript + '\n' +
        '<script>\n' + safe(t[3]) + '\n' + endScript + '\n' +
        '<script>\n' + safe(t[4]) + '\n' + endScript + '\n' +
        '</body>\n</html>\n';
    });
  };

  A['export-html'] = function (el) {
    if (!/^https?:$/.test(location.protocol)) {
      ed.toast('Tek dosya dışa aktarma için editörü web üzerinden açın (GitHub Pages ya da yerel sunucu — README\'ye bakın).', 'err');
      return;
    }
    el.disabled = true;
    ed.buildStandalone().then(function (html) {
      ed.download(ed.slug() + '.html', html, 'text/html;charset=utf-8');
      ed.toast('HTML dosyası indirildi (' + Math.round(html.length / 1024) + ' KB)');
    }).catch(function (e) {
      ed.toast('Dışa aktarılamadı: ' + e.message, 'err');
    }).then(function () { el.disabled = false; });
  };

  /* ---------- JSON (GitHub deposu) ---------- */

  A['export-json'] = function () {
    var data = DV.inviteData(DV.normalize(S()));
    var json = JSON.stringify(data, null, 2) + '\n';
    ed.download(ed.slug() + '.json', json, 'application/json');
    var kb = Math.round(json.length / 1024);
    ed.toast(ed.slug() + '.json indirildi (' + kb + ' KB)' + (kb > 900 ? ' — dosya büyük; fotoğrafları invitations/img/ klasörüne koymanız önerilir' : ''));
  };

  /* ---------- Proje dosyası ---------- */

  A['project-save'] = function () {
    var data = DV.clone(S());
    data._app = 'dijital-davetiye';
    data._saved = new Date().toISOString();
    ed.download('davetiye-projesi-' + ed.slug() + '.json', JSON.stringify(data, null, 2), 'application/json');
    ed.toast('Proje dosyası kaydedildi');
  };

  A['project-open'] = function () { ed.$('#fileOpen').click(); };

  A['project-new'] = function () { A['load-blank'](); };

  document.getElementById('fileOpen').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(function (txt) {
      var data = JSON.parse(txt);
      if (!DV.isObj(data) || !data.couple) throw new Error('Bu dosya bir davetiye projesi değil.');
      return ed.confirm('"' + esc(f.name) + '" açılacak; mevcut davetiyenin yerini alacak.', 'Aç').then(function (ok) {
        if (ok) {
          delete data._app; delete data._saved;
          ed.setState(data, 'Proje açıldı');
          ed.renderPvGroups();
        }
      });
    }).catch(function (err) {
      ed.toast('Dosya açılamadı: ' + err.message, 'err');
    });
  });
})();
