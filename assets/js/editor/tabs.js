/*!
 * Dijital Davetiye — editör sekmeleri
 * MIT Lisansı
 */
(function () {
  'use strict';

  var DV = window.DV, ed = DV.ed, esc = DV.esc, F = ed.f, A = ed.actions, icon = DV.icon;
  var card = ed.card;

  function S() { return ed.state; }

  function upcomingSaturday(monthsAhead) {
    var d = new Date();
    d.setMonth(d.getMonth() + monthsAhead);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    return d.toISOString().slice(0, 10);
  }

  /* ================================================================== *
   *  1) Hızlı başlangıç
   * ================================================================== */

  ed.progress = function () {
    var s = S();
    return [
      { tab: 'cift', label: 'Gelin ve damat bilgileri', done: !!(s.couple.bride.name && s.couple.groom.name) },
      { tab: 'etkinlikler', label: 'Etkinlikler, saatler ve konumlar', done: s.events.length > 0 && s.events.every(function (e) { return e.date && (DV.hasCoords(e) || e.address); }) },
      { tab: 'tasarim', label: 'Şablon ve renkler', done: true },
      { tab: 'lcv', label: 'Katılım bildirimi (LCV)', done: s.rsvp.method === 'none' || !!(s.rsvp.whatsapp || s.rsvp.email || s.rsvp.endpoint || s.rsvp.formUrl) },
      { tab: 'yayinla', label: 'Yayınla ve paylaş', done: false }
    ];
  };

  ed.tab('baslangic', {
    label: 'Başlangıç', icon: 'star', title: 'Hoş geldiniz 💍', section: 'hero',
    desc: 'Dijital davetiyenizi birkaç adımda hazırlayın. Tüm değişiklikler bu tarayıcıya otomatik kaydedilir ve sağdaki önizlemede anında görünür.',
    render: function () {
      var s = S();
      var main = DV.mainEvent(s.events);
      var qd = ed.ui.qsDate || (main && main.date) || upcomingSaturday(6);
      var steps = ed.progress().map(function (st, i) {
        return '<li class="' + (st.done ? 'done' : '') + '"><button type="button" data-action="goto" data-tab="' + st.tab + '"><span class="st-n">' + (st.done ? icon('check') : i + 1) + '</span>' + esc(st.label) + icon('right', 'st-go') + '</button></li>';
      }).join('');

      var presets = DV.PRESETS.map(function (p) {
        return '<button type="button" class="preset" data-action="preset" data-id="' + p.id + '">' +
          '<strong>' + esc(p.name) + '</strong><span>' + esc(p.desc) + '</span>' +
          '<em>' + p.events.map(function (e) { return esc(e.title || DV.eventType(e.type).tr); }).join(' → ') + '</em></button>';
      }).join('');

      return card('Adımlar', '<ol class="steps">' + steps + '</ol>') +
        card('Hazır senaryo ile başlayın',
          '<div class="row3">' +
          '<div class="fld"><label for="qsDate">Ana tarih (düğün günü)</label><input type="date" id="qsDate" value="' + esc(qd) + '"></div>' +
          '<div class="fld"><label for="qsA">Gelin tarafı şehri</label><input type="text" id="qsA" placeholder="İzmir" value="' + esc(ed.ui.qsA || '') + '"></div>' +
          '<div class="fld"><label for="qsB">Damat tarafı şehri</label><input type="text" id="qsB" placeholder="İstanbul (aynıysa boş bırakın)" value="' + esc(ed.ui.qsB || '') + '"></div>' +
          '</div><div class="presets">' + presets + '</div>',
          { desc: 'Senaryo, etkinlik listesini tarih ve şehirlerle hazır doldurur. Sonra saatleri, mekanları ve konumları düzenlersiniz.', icon: 'sparkle' }) +
        card('Diğer seçenekler',
          '<div class="btns">' +
          '<button type="button" class="btn-s" data-action="load-sample">' + icon('heart') + ' Örnek davetiyeyi yükle</button>' +
          '<button type="button" class="btn-s" data-action="load-blank">' + icon('x') + ' Boş davetiye ile başla</button>' +
          '<button type="button" class="btn-s" data-action="project-open">' + icon('download', 'rot180') + ' Proje dosyası aç</button>' +
          '</div>');
    }
  });

  A.preset = function (el) {
    var p = DV.PRESETS.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (!p) return;
    var date = ed.$('#qsDate').value, cityA = ed.$('#qsA').value.trim(), cityB = ed.$('#qsB').value.trim();
    ed.ui.qsDate = date; ed.ui.qsA = cityA; ed.ui.qsB = cityB;
    var apply = function () {
      S().events = p.events.map(function (pe) {
        var e = DV.newEvent(pe.type);
        e.title = pe.title || '';
        e.date = date ? DV.dt.addDays(date, pe.day || 0) : '';
        e.start = pe.start || '';
        e.end = pe.end || '';
        e.host = pe.host || '';
        e.main = !!pe.main;
        e.city = pe.city === 'B' ? (cityB || cityA) : cityA;
        return e;
      });
      var kickers = DV.PRESETS.map(function (x) { return x.kicker; }).filter(Boolean);
      if (p.kicker) S().texts.kicker = p.kicker;
      else if (kickers.indexOf(S().texts.kicker) >= 0) S().texts.kicker = '';
      ed.ui.openEvent = null;
      ed.changed();
      ed.toast('"' + p.name + '" uygulandı — şimdi mekanları ve konumları ekleyin');
      ed.go('etkinlikler');
    };
    if (S().events.length) {
      ed.confirm('Mevcut ' + S().events.length + ' etkinlik silinecek ve "' + esc(p.name) + '" senaryosu uygulanacak.', 'Uygula').then(function (ok) { if (ok) apply(); });
    } else apply();
  };

  A['load-sample'] = function () {
    ed.confirm('Mevcut davetiyenizin yerine örnek davetiye yüklenecek. Önce "Kaydet" ile yedek almak isteyebilirsiniz.', 'Örneği yükle', true).then(function (ok) {
      if (ok) ed.setState(DV.sample(), 'Örnek davetiye yüklendi');
    });
  };
  A['load-blank'] = function () {
    ed.confirm('Tüm bilgiler silinip boş bir davetiye açılacak.', 'Boş başla', true).then(function (ok) {
      if (!ok) return;
      var d = DV.defaults();
      d.events = [DV.newEvent('dugun')];
      d.events[0].main = true;
      ed.setState(d, 'Boş davetiye açıldı');
      ed.go('cift');
    });
  };

  /* ================================================================== *
   *  2) Çift
   * ================================================================== */

  ed.tab('cift', {
    label: 'Çift', icon: 'heart', title: 'Gelin & Damat', section: 'hero',
    desc: 'İsimler kapakta, aile adları davet metninin üstünde görünür.',
    render: function () {
      var person = function (k, title, ph) {
        return card(title,
          F.row(F.text('couple.' + k + '.name', 'Adı', { placeholder: ph[0], maxlength: 40 }), F.text('couple.' + k + '.surname', 'Soyadı', { placeholder: ph[1], maxlength: 40, optional: true })) +
          F.text('couple.' + k + '.parents', 'Anne & baba adı', { placeholder: ph[2], optional: true, hint: 'Ör: "Ayşe & Mehmet Yıldız". Türk davetiyelerindeki aile satırı olarak görünür.' }),
          { icon: k === 'bride' ? 'flower' : 'star' });
      };
      return person('bride', 'Gelin', ['Elif', 'Yıldız', 'Ayşe & Mehmet Yıldız']) +
        person('groom', 'Damat', ['Can', 'Aydın', 'Zeynep & Ali Aydın']) +
        card('Görünüm',
          F.row(
            F.select('couple.order', 'İsim sırası', [['bride', 'Önce gelin (Elif & Can)'], ['groom', 'Önce damat (Can & Elif)']]),
            F.text('couple.hashtag', 'Düğün hashtag\'i', { placeholder: '#ElifileCan', optional: true })
          )) +
        card('Kapak fotoğrafı',
          ed.imageField('couple.photo', {
            max: 1800,
            extra: F.select('couple.photoPos', 'Fotoğraf odak noktası', [['top', 'Üst'], ['center', 'Orta'], ['bottom', 'Alt']])
          }),
          { desc: 'İsteğe bağlı. Şablona göre yuvarlak, kemer veya tam ekran gösterilir. Yüklenen fotoğraflar otomatik küçültülür.', icon: 'camera' });
    }
  });

  /* ================================================================== *
   *  3) Etkinlikler
   * ================================================================== */

  function evMeta(ev) {
    return [
      ev.date ? DV.dt.formatDate('tr', ev.date, false) : 'Tarih yok',
      ev.start ? ev.start + (ev.end ? '–' + ev.end : '') : '',
      ev.city
    ].filter(Boolean).join(' · ');
  }

  function evHead(ev) {
    var t = DV.eventType(ev.type);
    var badges = '';
    if (ev.main) badges += '<b class="bdg main">Ana</b>';
    if (ev.hidden) badges += '<b class="bdg">Gizli</b>';
    if (ev.groups && ev.groups.length) badges += '<b class="bdg grp">' + ev.groups.length + ' grup</b>';
    if (!DV.hasCoords(ev) && !ev.address) badges += '<b class="bdg warn">Konum yok</b>';
    return '<span class="evh-ic">' + icon(t.icon) + '</span><span class="evh-t"><strong>' + esc(DV.eventName(ev, 'tr')) + '</strong><span>' + esc(evMeta(ev)) + '</span></span><span class="evh-b">' + badges + '</span>';
  }

  ed.refreshEventHead = function (i) {
    var ev = S().events[i];
    var el = ed.$('[data-ev-head="' + i + '"]');
    if (ev && el) el.innerHTML = evHead(ev);
  };

  function eventCard(ev, i, all) {
    var open = ed.ui.openEvent === ev.id;
    var p = 'events.' + i + '.';
    var h = '<article class="evc' + (open ? ' open' : '') + '" id="evc-' + esc(ev.id) + '">' +
      '<header class="evc-h"><button type="button" class="evc-toggle" data-action="event-toggle" data-id="' + esc(ev.id) + '" aria-expanded="' + open + '"><span class="evh" data-ev-head="' + i + '">' + evHead(ev) + '</span>' + icon('chevron', 'evc-chev') + '</button>' +
      '<div class="it-tools">' +
      '<button type="button" class="ib" data-action="list-up" data-path="events" data-i="' + i + '" title="Yukarı taşı"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron', 'rot180') + '</button>' +
      '<button type="button" class="ib" data-action="list-down" data-path="events" data-i="' + i + '" title="Aşağı taşı"' + (i === all.length - 1 ? ' disabled' : '') + '>' + icon('chevron') + '</button>' +
      '<button type="button" class="ib" data-action="event-dup" data-i="' + i + '" title="Kopyasını oluştur">' + icon('copy') + '</button>' +
      '<button type="button" class="ib danger" data-action="event-del" data-i="' + i + '" title="Sil">' + icon('x') + '</button>' +
      '</div></header>';
    if (!open) return h + '</article>';

    var types = DV.EVENT_TYPES.map(function (t) { return [t.id, t.tr]; });
    var loc = DV.hasCoords(ev)
      ? '<div class="loc-ok">' + icon('pin') + '<span>Konum seçildi <code>' + ev.lat.toFixed(5) + ', ' + ev.lng.toFixed(5) + '</code></span>' +
        '<a href="' + esc(DV.links.googlePlace(ev)) + '" target="_blank" rel="noopener">Haritada kontrol et</a>' +
        '<button type="button" class="lnk danger" data-action="loc-clear" data-i="' + i + '">Kaldır</button></div>'
      : '<div class="loc-none">' + icon('info') + '<span>Haritadan konum seçilmedi. Yol tarifi yalnızca adres metniyle yapılır — tam konum için seçmeniz önerilir.</span></div>';

    var groups = S().guests.groups;
    var vis = groups.length
      ? '<div class="fld"><label>Kimler görsün?</label><div class="chips">' +
        groups.map(function (g) {
          return '<label class="chip"><input type="checkbox" data-hook="ev-group" data-i="' + i + '" value="' + esc(g.id) + '"' + (ev.groups.indexOf(g.id) >= 0 ? ' checked' : '') + '><span>' + esc(g.name) + '</span></label>';
        }).join('') +
        '</div><p class="hint">Hiçbiri seçili değilse <b>herkes</b> görür. Seçerseniz yalnızca o gruplara özel bağlantılarda görünür (ör. After Party yalnızca Arkadaşlar).</p></div>'
      : '<p class="hint">' + icon('users') + ' Bu etkinliği sadece belirli misafirlere göstermek için <a href="#" data-action="goto" data-tab="misafirler">Misafirler</a> sekmesinden grup oluşturun.</p>';

    h += '<div class="evc-b">' +
      F.row(
        F.select(p + 'type', 'Etkinlik türü', types, { rerender: true }),
        F.text(p + 'title', 'Özel başlık', { placeholder: DV.eventType(ev.type).tr, optional: true, maxlength: 60 })
      ) +
      '<div class="row3">' + F.date(p + 'date', 'Tarih') + F.time(p + 'start', 'Başlangıç saati') + F.time(p + 'end', 'Bitiş saati', { optional: true }) + '</div>' +
      F.row(F.text(p + 'venue', 'Mekan adı', { placeholder: 'Ör: Kordon Davet Bahçesi' }), F.text(p + 'city', 'Şehir', { placeholder: 'Ör: İzmir', hint: 'Farklı şehirdeki etkinlikler davetiyede şehre göre gruplanır.' })) +
      F.area(p + 'address', 'Adres', { rows: 2, placeholder: 'Mahalle, cadde, ilçe…' }) +
      '<div class="loc">' + loc +
      '<div class="btns"><button type="button" class="btn-s primary" data-action="loc-pick" data-i="' + i + '">' + icon('map') + ' Haritadan seç</button>' +
      (i > 0 ? '<button type="button" class="btn-s" data-action="loc-copy-prev" data-i="' + i + '">' + icon('copy') + ' Önceki etkinliğin mekanını kopyala</button>' : '') + '</div>' +
      '<div class="loc-paste"><input type="text" class="sm" id="locPaste' + i + '" placeholder="veya Google Maps / Yandex / Apple Maps linki ya da 41.0082, 28.9784"><button type="button" class="btn-s" data-action="loc-paste" data-i="' + i + '">Uygula</button></div>' +
      '</div>' +
      F.row(
        F.select(p + 'host', 'Ev sahibi', [['', 'Ortak / belirtme'], ['bride', 'Kız tarafı'], ['groom', 'Erkek tarafı']], { rerender: true }),
        F.text(p + 'dress', 'Kıyafet', { placeholder: 'Ör: Şık / Abiye, Beyaz', optional: true })
      ) +
      F.area(p + 'note', 'Not', { rows: 2, placeholder: 'Ör: Çocuklar için oyun alanı mevcuttur. Servis 18:00\'de kalkar.', optional: true }) +
      vis +
      '<div class="sw-row">' + F.check(p + 'main', 'Ana etkinlik (geri sayım ve kapak tarihi buna göre)', { rerender: true }) + F.check(p + 'hidden', 'Davetiyede gizle', { rerender: true }) + '</div>' +
      '</div>';
    return h + '</article>';
  }

  ed.tab('etkinlikler', {
    label: 'Etkinlikler', icon: 'cal', title: 'Etkinlikler', section: 'events',
    desc: 'Tek ilde ya da iki ilde düğün, kına, gelin alma, resmi nikah, after party… Her etkinliğin tarihi, saati ve haritadan konumu ayrı ayrı ayarlanır.',
    render: function () {
      var s = S();
      var add = '<div class="type-grid">' + DV.EVENT_TYPES.map(function (t) {
        return '<button type="button" class="type-btn" data-action="event-add" data-type="' + t.id + '">' + icon(t.icon) + '<span>' + esc(t.tr) + '</span></button>';
      }).join('') + '</div>';
      var list = s.events.length
        ? s.events.map(function (ev, i, all) { return eventCard(ev, i, all); }).join('')
        : '<div class="empty">' + icon('cal') + '<p>Henüz etkinlik yok. Yukarıdan bir tür seçin ya da <a href="#" data-action="goto" data-tab="baslangic">hazır senaryo</a> uygulayın.</p></div>';
      var cities = DV.cities(s.events);
      var tools = s.events.length > 1
        ? '<div class="toolbar"><button type="button" class="btn-s" data-action="events-sort">' + icon('clock') + ' Tarihe göre sırala</button>' +
          (cities.length > 1 ? F.check('design.groupByCity', 'Davetiyede şehre göre grupla (' + cities.map(esc).join(', ') + ')') : '') + '</div>'
        : '';
      return card('Etkinlik ekle', add, { icon: 'sparkle' }) + tools + '<div class="ev-cards">' + list + '</div>';
    }
  });

  A['event-toggle'] = function (el) {
    var id = el.getAttribute('data-id');
    ed.ui.openEvent = ed.ui.openEvent === id ? null : id;
    ed.render(true);
    if (ed.ui.openEvent) {
      ed.scrollPanelTo(ed.$('#evc-' + id), 'nearest');
    }
  };

  A['event-add'] = function (el) {
    var s = S();
    var ev = DV.newEvent(el.getAttribute('data-type'));
    var main = DV.mainEvent(s.events);
    var last = s.events[s.events.length - 1];
    ev.date = (main && main.date) || '';
    if (last) ev.city = last.city;
    if (!s.events.length) ev.main = true;
    s.events.push(ev);
    ed.ui.openEvent = ev.id;
    ed.changed({ rerender: true });
    setTimeout(function () {
      ed.scrollPanelTo(ed.$('#evc-' + ev.id));
    }, 30);
  };

  A['event-dup'] = function (el) {
    var i = +el.getAttribute('data-i');
    var copy = DV.clone(S().events[i]);
    copy.id = DV.uid('e');
    copy.main = false;
    S().events.splice(i + 1, 0, copy);
    ed.ui.openEvent = copy.id;
    ed.changed({ rerender: true });
    ed.toast('Etkinlik kopyalandı');
  };

  A['event-del'] = function (el) {
    var i = +el.getAttribute('data-i');
    var ev = S().events[i];
    ed.confirm('"' + esc(DV.eventName(ev, 'tr')) + '" etkinliği silinecek.', 'Sil', true).then(function (ok) {
      if (!ok) return;
      S().events.splice(i, 1);
      ed.changed({ rerender: true });
    });
  };

  A['events-sort'] = function () {
    S().events = DV.sortEvents(S().events);
    ed.changed({ rerender: true });
    ed.toast('Etkinlikler tarihe göre sıralandı');
  };

  A['loc-clear'] = function (el) {
    var ev = S().events[+el.getAttribute('data-i')];
    ev.lat = null; ev.lng = null;
    ed.changed({ rerender: true });
  };

  A['loc-copy-prev'] = function (el) {
    var i = +el.getAttribute('data-i');
    var ev = S().events[i], prev = S().events[i - 1];
    ['venue', 'address', 'city', 'lat', 'lng'].forEach(function (k) { ev[k] = prev[k]; });
    ed.changed({ rerender: true });
    ed.toast('Mekan bilgisi kopyalandı');
  };

  /** Harita bağlantısından veya "enlem, boylam" metninden koordinat çıkarır. */
  ed.parseLocation = function (str) {
    var s = String(str || '').trim();
    if (!s) return null;
    try { s = decodeURIComponent(s); } catch (e) { /* yoksay */ }
    var ok = function (a, b) {
      var lat = parseFloat(a), lng = parseFloat(b);
      return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: lat, lng: lng } : null;
    };
    var m;
    if (/yandex\./i.test(s)) {
      // Yandex: ll / pt / rtext boylam,enlem sırasıyla gelir (rtext hariç)
      if ((m = /[?&]pt=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s))) return ok(m[2], m[1]);
      if ((m = /rtext=[^&]*~(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s))) return ok(m[1], m[2]);
      if ((m = /[?&]ll=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(s))) return ok(m[2], m[1]);
    }
    if ((m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s))) return ok(m[1], m[2]);
    if ((m = /[?&](?:q|query|ll|sll|destination|daddr|center|coordinate)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i.exec(s))) return ok(m[1], m[2]);
    if ((m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s))) return ok(m[1], m[2]);
    if ((m = /^(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)$/.exec(s))) return ok(m[1].replace(',', '.'), m[2].replace(',', '.'));
    return null;
  };

  A['loc-paste'] = function (el) {
    var i = +el.getAttribute('data-i');
    var input = ed.$('#locPaste' + i);
    var val = input.value.trim();
    if (!val) { input.focus(); return; }
    var c = ed.parseLocation(val);
    if (!c) {
      if (/goo\.gl|maps\.app/i.test(val)) ed.toast('Kısa linkler tarayıcıda çözülemiyor. Linki açıp adres çubuğundaki uzun adresi yapıştırın ya da "Haritadan seç"i kullanın.', 'err');
      else ed.toast('Bu bağlantıdan konum okunamadı. "Haritadan seç" ile işaretleyebilirsiniz.', 'err');
      return;
    }
    var ev = S().events[i];
    ev.lat = c.lat; ev.lng = c.lng;
    ed.changed({ rerender: true });
    ed.toast('Konum ayarlandı');
  };

  ed.hooks['ev-group'] = function (el) {
    var i = +el.getAttribute('data-i');
    var ev = S().events[i];
    ev.groups = ed.$$('[data-hook="ev-group"][data-i="' + i + '"]').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
    ed.refreshEventHead(i);
    ed.changed();
  };

  /* ================================================================== *
   *  4) İçerik (metinler)
   * ================================================================== */

  var INTROS = [
    'Hayatımızın en özel gününde bu mutluluğu sizinle paylaşmak, sizleri de aramızda görmek istiyoruz.',
    'Bir ömür sürecek yolculuğumuzun ilk adımında sizleri de yanımızda görmekten mutluluk duyarız.',
    'Sevgimizi ömür boyu sürecek bir birlikteliğe dönüştürdüğümüz bu güzel günde, sizleri de aramızda görmekten onur duyarız.',
    'Ailelerimizin hayır duaları ile hayatlarımızı birleştiriyoruz. Bu mutlu günümüzde sizleri de aramızda görmek isteriz.',
    'Aşkla başlayan hikayemizin en güzel sayfasını birlikte yazmak için sizi düğünümüze davet ediyoruz.',
    'Gülüşlerimizi, dualarımızı ve sevincimizi paylaşmak için bu özel günde yanımızda olmanızı dileriz.'
  ];
  var QUOTES = [
    'Seninle her şey yeniden başlıyor.',
    'Bir ömür, bir söz, bir aşk.',
    'Birlikte yaşlanmaya söz veriyoruz.',
    'İki yürek, tek yol.',
    'Ve sonra, sonsuza dek…',
    'En güzel hikaye, bizim hikayemiz.'
  ];

  function suggestions(list, path) {
    return '<div class="sugg">' + list.map(function (t) {
      return '<button type="button" class="sugg-i" data-action="set-text" data-path="' + path + '" data-text="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';
  }

  A['set-text'] = function (el) {
    DV.set(S(), el.getAttribute('data-path'), el.getAttribute('data-text'));
    ed.changed({ rerender: true });
  };

  ed.tab('icerik', {
    label: 'Metinler', icon: 'pen', title: 'Metinler & dil', section: 'intro',
    desc: 'Boş bıraktığınız alanlarda seçtiğiniz dile uygun hazır metinler kullanılır.',
    render: function () {
      var lang = S().lang;
      var tz = DV.TIMEZONES.map(function (z) { return [z, z.replace('_', ' ')]; });
      return card('Dil ve saat dilimi',
        F.row(
          F.select('lang', 'Davetiye dili', [['tr', 'Türkçe'], ['en', 'English']], { rerender: true, hint: 'Butonlar, tarih biçimi ve hazır metinler bu dilde olur.' }),
          F.select('timezone', 'Saat dilimi', tz, { hint: 'Takvime ekleme ve geri sayım için. Yurt dışındaki düğünlerde değiştirin.' })
        ), { icon: 'clock' }) +
        card('Kapak',
          F.text('texts.kicker', 'Üst başlık', { placeholder: DV.t(lang, 'kicker'), maxlength: 60, hint: 'Ör: "Evleniyoruz", "Nişanlanıyoruz", "Kına Gecemize Davetlisiniz".' }) +
          F.text('texts.greeting', 'Kişiye özel hitap', { placeholder: DV.t(lang, 'greeting'), maxlength: 60, hint: 'Misafire özel bağlantılarda zarfın ve kapağın üstünde görünür. <code>{isim}</code> misafirin adıyla değişir.' }),
          { icon: 'star' }) +
        card('Davet metni',
          F.area('texts.intro', 'Davet metni', { rows: 4, placeholder: DV.t(lang, 'intro') }) +
          (lang === 'tr' ? '<p class="sub">Hazır metinler — tıklayarak kullanın:</p>' + suggestions(INTROS, 'texts.intro') : '') +
          F.text('texts.familyLine', 'Aile satırı', { placeholder: 'Ör: Yıldız ve Aydın Aileleri', optional: true }),
          { icon: 'mail' }) +
        card('Alıntı',
          F.row(F.area('texts.quote', 'Alıntı / şiir dizesi', { rows: 2, optional: true }), F.text('texts.quoteAuthor', 'Kime ait?', { optional: true })) +
          (lang === 'tr' ? suggestions(QUOTES, 'texts.quote') : ''),
          { icon: 'book' }) +
        card('Kapanış',
          F.area('texts.closing', 'Kapanış metni', { rows: 2, placeholder: DV.t(lang, 'closing') }) +
          F.text('texts.signature', 'İmza', { placeholder: DV.coupleNames(S()) || 'Elif & Can', optional: true }),
          { icon: 'heart' });
    }
  });

  /* ================================================================== *
   *  5) Ekstralar
   * ================================================================== */

  function listBlock(path, kind, items, renderItem, addLabel, empty) {
    var body = items.length
      ? '<div class="list" data-list="' + path + '">' + items.map(function (it, i) {
        return '<div class="item"><div class="item-b">' + renderItem(it, path + '.' + i, i) + '</div>' + ed.itemTools(path, i, items.length) + '</div>';
      }).join('') + '</div>'
      : '<p class="empty-s">' + empty + '</p>';
    return body + '<button type="button" class="btn-s add" data-action="list-add" data-path="' + path + '" data-kind="' + kind + '">+ ' + esc(addLabel) + '</button>';
  }
  ed.listBlock = listBlock;

  ed.tab('ekstralar', {
    label: 'Ekstralar', icon: 'gift', title: 'Hikaye, galeri, bilgiler & müzik', section: 'story',
    desc: 'Hepsi isteğe bağlı. Boş bıraktığınız bölümler davetiyede görünmez.',
    render: function () {
      var s = S();

      var story = listBlock('story', 'story', s.story, function (it, p) {
        return F.row(F.text(p + '.date', 'Tarih', { placeholder: '2019 / Haziran 2021' }), F.text(p + '.title', 'Başlık', { placeholder: 'İlk tanışma' })) +
          F.area(p + '.text', 'Açıklama', { rows: 2 });
      }, 'Anı ekle', 'Tanışma, ilk tatil, evlenme teklifi… Hikayenizi birkaç adımda anlatın.');

      var gal = s.gallery.length
        ? '<div class="gal" data-list="gallery">' + s.gallery.map(function (g, i) {
          var src = DV.safeUrl(g.src, 'image');
          return '<div class="item gal-i"><div class="gal-img">' + (src ? '<img src="' + esc(src) + '" alt="">' : '') + '</div>' +
            '<input type="text" class="sm" data-bind="gallery.' + i + '.caption" placeholder="Açıklama (isteğe bağlı)">' + ed.itemTools('gallery', i, s.gallery.length) + '</div>';
        }).join('') + '</div>'
        : '<p class="empty-s">Henüz fotoğraf yok.</p>';
      gal += '<div class="btns"><label class="btn-s primary">' + icon('camera') + ' Fotoğraf yükle<input type="file" accept="image/*" multiple hidden data-upload="gallery" data-max="1400"></label>' +
        '<div class="inline-add"><input type="url" class="sm" id="galUrl" placeholder="veya görsel bağlantısı (https://…)"><button type="button" class="btn-s" data-action="gallery-url">Ekle</button></div></div>';

      var iconOpts = DV.INFO_ICONS.map(function (k) { return [k, INFO_ICON_LABELS[k] || k]; });
      var info = listBlock('info', 'info', s.info, function (it, p) {
        return '<div class="row info-row"><span class="info-prev">' + icon(it.icon) + '</span>' + F.select(p + '.icon', 'İkon', iconOpts, { rerender: true }) + F.text(p + '.title', 'Başlık', { placeholder: 'Servis / Otopark / Konaklama' }) + '</div>' +
          F.area(p + '.text', 'Açıklama', { rows: 2 }) +
          F.row(F.text(p + '.link', 'Bağlantı', { placeholder: 'https://…', optional: true, type: 'url' }), F.text(p + '.linkText', 'Bağlantı yazısı', { placeholder: 'Otel bilgisi', optional: true }));
      }, 'Bilgi kartı ekle', 'Servis saatleri, otopark, konaklama, çocuklar, kıyafet… Misafirlerin bilmesi gereken her şey.');

      var acc = listBlock('gift.accounts', 'account', s.gift.accounts, function (it, p) {
        return F.row(F.text(p + '.bank', 'Banka', { placeholder: 'Ör: Ziraat Bankası' }), F.text(p + '.holder', 'Alıcı adı', { placeholder: 'Elif Yıldız' })) +
          F.text(p + '.iban', 'IBAN', { placeholder: 'TR00 0000 0000 0000 0000 0000 00', maxlength: 42 });
      }, 'Hesap ekle', 'Hesap eklenmedi.');

      var music = s.music.url;
      var musicBody =
        '<div class="btns"><label class="btn-s primary">' + icon('music') + ' Müzik dosyası yükle (mp3)<input type="file" accept="audio/*" hidden data-upload="audio" data-path="music.url"></label>' +
        (music ? '<button type="button" class="btn-s" data-action="clear-path" data-path="music.url">' + icon('x') + ' Kaldır</button>' : '') + '</div>' +
        '<input type="url" class="sm" data-url-for="music.url" placeholder="veya mp3 bağlantısı (https://…/sarki.mp3)">' +
        (music ? '<audio controls preload="none" src="' + esc(DV.safeUrl(music, 'audio')) + '"></audio>' : '') +
        (DV.isDataUrl(music) ? '<p class="hint">Cihazdan yüklendi (' + Math.round(music.length * 0.75 / 1024) + ' KB). Paylaşım bağlantısına sığmaz; "Tek dosya HTML" ve "JSON" yöntemlerinde yer alır.</p>' : '') +
        F.row(F.text('music.title', 'Şarkı adı', { optional: true }), '') +
        F.check('music.autoplay', 'Zarf açılınca müziği başlat') +
        '<p class="hint">YouTube/Spotify bağlantıları çalışmaz; doğrudan .mp3 dosyası gerekir. Telif hakkı olan şarkıları herkese açık sitelerde paylaşırken dikkatli olun.</p>';

      return card('Hikayemiz', story, { icon: 'heart' }) +
        card('Fotoğraf galerisi', gal, { icon: 'camera', desc: 'Fotoğraflar otomatik küçültülür. İlk fotoğraf büyük gösterilir.' }) +
        card('Bilmeniz gerekenler', info, { icon: 'info' }) +
        card('Hediye / IBAN',
          F.area('gift.text', 'Açıklama', { rows: 2, placeholder: DV.t(s.lang, 'giftDefault') }) + acc,
          { icon: 'gift', desc: 'İsteğe bağlı. Hesap eklemezseniz ve açıklama yazmazsanız bu bölüm görünmez.' }) +
        card('Arka plan müziği', musicBody, { icon: 'music' }) +
        '<p class="hint center">Bölümlerin sırasını ve görünürlüğünü <a href="#" data-action="goto" data-tab="tasarim">Tasarım</a> sekmesinden değiştirebilirsiniz.</p>';
    }
  });

  var INFO_ICON_LABELS = {
    info: 'Bilgi', bus: 'Servis', parking: 'Otopark', hotel: 'Otel', bed: 'Konaklama', plane: 'Ulaşım / uçak',
    shirt: 'Kıyafet', child: 'Çocuklar', camera: 'Fotoğraf', gift: 'Hediye', clock: 'Saat', pin: 'Konum',
    phone: 'Telefon', heart: 'Kalp', glass: 'İkram', music: 'Müzik', dinner: 'Yemek', cake: 'Pasta',
    flower: 'Çiçek', star: 'Yıldız', users: 'Misafirler'
  };

  A['gallery-url'] = function () {
    var inp = ed.$('#galUrl');
    var u = DV.safeUrl(inp.value.trim(), 'image');
    if (!u) { ed.toast('Geçerli bir görsel bağlantısı girin', 'err'); return; }
    S().gallery.push({ src: u, caption: '' });
    ed.changed({ rerender: true });
  };

  /* ================================================================== *
   *  6) LCV & iletişim
   * ================================================================== */

  ed.APPS_SCRIPT =
    "// Dijital Davetiye — LCV yanıtlarını Google E-Tablolar'a kaydeder\n" +
    "function doPost(e) {\n" +
    "  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];\n" +
    "  if (sheet.getLastRow() === 0) {\n" +
    "    sheet.appendRow(['Tarih', 'Ad Soyad', 'Katılım', 'Kişi', 'Etkinlikler', 'Not', 'Grup']);\n" +
    "  }\n" +
    "  var d = JSON.parse(e.postData.contents);\n" +
    "  sheet.appendRow([new Date(), d.name, d.attendingText, d.count, d.events, d.note, d.group]);\n" +
    "  return ContentService.createTextOutput(JSON.stringify({ ok: true }))\n" +
    "    .setMimeType(ContentService.MimeType.JSON);\n" +
    "}\n";

  A['show-apps-script'] = function () {
    ed.modal({
      title: 'Google E-Tablolar ile LCV toplama',
      wide: true,
      body:
        '<ol class="guide">' +
        '<li><a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> ile yeni bir Google E-Tablo açın.</li>' +
        '<li>Menüden <b>Uzantılar → Apps Script</b>\'e tıklayın, içindekileri silip aşağıdaki kodu yapıştırın ve kaydedin.</li>' +
        '<li><b>Dağıt → Yeni dağıtım → Tür: Web uygulaması</b> seçin. <i>Erişimi olanlar</i>: <b>Herkes</b> olmalı. Dağıt\'a basıp izinleri onaylayın.</li>' +
        '<li>Verilen <code>https://script.google.com/macros/s/…/exec</code> adresini kopyalayıp editördeki alana yapıştırın.</li>' +
        '</ol><pre class="code">' + esc(ed.APPS_SCRIPT) + '</pre>',
      actions: [{ label: 'Kodu kopyala', primary: true, onClick: function () { ed.copy(ed.APPS_SCRIPT, 'Kod kopyalandı'); return false; } }, { label: 'Kapat' }]
    });
  };

  ed.tab('lcv', {
    label: 'LCV', icon: 'mail', title: 'LCV & iletişim', section: 'rsvp',
    desc: 'Misafirleriniz katılım durumunu davetiye üzerinden bildirir. Sunucu gerekmez.',
    render: function () {
      var r = S().rsvp;
      var methods = [
        ['whatsapp', 'WhatsApp mesajı (en kolay)'],
        ['sheets', 'Google E-Tablolar (otomatik liste)'],
        ['formspree', 'Formspree (e-posta bildirimi)'],
        ['email', 'E-posta uygulaması'],
        ['link', 'Harici form bağlantısı (Google Forms vb.)'],
        ['none', 'LCV bölümü olmasın']
      ];
      var m = '';
      if (r.method === 'whatsapp') m = F.text('rsvp.whatsapp', 'WhatsApp numarası', { placeholder: '0532 123 45 67', inputmode: 'tel', hint: 'Misafir formu doldurduğunda bu numaraya hazır yazılmış bir mesajla WhatsApp açılır.' });
      if (r.method === 'email') m = F.text('rsvp.email', 'E-posta adresi', { type: 'email', placeholder: 'elif.can@ornek.com', hint: 'Misafirin e-posta uygulaması hazır mesajla açılır.' });
      if (r.method === 'sheets') m = F.text('rsvp.endpoint', 'Apps Script web uygulaması adresi', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', hint: 'Yanıtlar otomatik olarak Google E-Tablonuza satır satır eklenir. <a href="#" data-action="show-apps-script">5 dakikalık kurulum</a>' });
      if (r.method === 'formspree') m = F.text('rsvp.endpoint', 'Formspree form adresi', { type: 'url', placeholder: 'https://formspree.io/f/xxxxxxx', hint: '<a href="https://formspree.io" target="_blank" rel="noopener">formspree.io</a>\'da ücretsiz form oluşturun; her yanıt e-postanıza gelir.' });
      if (r.method === 'link') m = F.text('rsvp.formUrl', 'Form bağlantısı', { type: 'url', placeholder: 'https://forms.gle/…' });

      var opts = r.method === 'none' || r.method === 'link' ? '' :
        F.row(F.date('rsvp.deadline', 'Son yanıt tarihi', { optional: true }), F.number('rsvp.maxCount', 'En fazla kişi sayısı', { min: 1, max: 50 })) +
        '<div class="sw-col">' + F.check('rsvp.askCount', 'Kişi sayısını sor') + F.check('rsvp.askEvents', 'Hangi etkinliklere katılacağını sor (birden fazla etkinlik varsa)') + '</div>';

      var contacts = ed.listBlock('contacts', 'contact', S().contacts, function (it, p) {
        return F.row(F.text(p + '.name', 'Ad Soyad'), F.text(p + '.role', 'Açıklama', { placeholder: 'Gelinin annesi / Organizasyon' })) +
          F.text(p + '.phone', 'Telefon', { placeholder: '0532 123 45 67', inputmode: 'tel' });
      }, 'Kişi ekle', 'Misafirlerin sorularını iletebileceği kişiler (ara / WhatsApp butonlarıyla görünür).');

      return card('Katılım bildirimi',
        F.select('rsvp.method', 'Yanıtlar nasıl toplansın?', methods, { rerender: true }) + m + opts +
        (r.method === 'none' ? '' : F.area('rsvp.text', 'Özel LCV metni', { rows: 2, optional: true, placeholder: r.deadline ? DV.t(S().lang, 'rsvpBy', { date: DV.dt.formatDate(S().lang, r.deadline, false) }) : DV.t(S().lang, 'rsvpIntro') })),
        { icon: 'check' }) +
        card('İletişim', contacts, { icon: 'phone' });
    }
  });

  /* ================================================================== *
   *  7) Tasarım
   * ================================================================== */

  var PALETTES = [
    { name: 'Bordo & Altın', c: { bg: '#faf5ef', text: '#3a2226', primary: '#7d1d2c', accent: '#d9b67a' } },
    { name: 'Zümrüt', c: { bg: '#f3f6f2', text: '#1f2e27', primary: '#1f5a43', accent: '#c9a96a' } },
    { name: 'Şampanya', c: { bg: '#fbf8f3', text: '#4a4036', primary: '#b89b72', accent: '#efe2cc' } },
    { name: 'Lacivert & Gümüş', c: { bg: '#f4f6fa', text: '#1c2740', primary: '#24345e', accent: '#b9c2d3' } },
    { name: 'Gül Kurusu', c: { bg: '#f8efed', text: '#4e3236', primary: '#a8676f', accent: '#e7c3c1' } },
    { name: 'Zeytin', c: { bg: '#f5f4ec', text: '#33361f', primary: '#6b7238', accent: '#d8d3a8' } },
    { name: 'Gece Siyahı', c: { bg: '#141414', text: '#efe9df', primary: '#c8a96a', accent: '#5b4a2b' } },
    { name: 'Mercan', c: { bg: '#fff6f2', text: '#4b2f28', primary: '#d8674f', accent: '#f6c2a8' } }
  ];

  function tplCard(t) {
    var active = S().design.template === t.id;
    var c = t.colors;
    var names = DV.coupleNames(S()) || 'Elif & Can';
    return '<button type="button" class="tpl' + (active ? ' active' : '') + '" data-action="tpl" data-id="' + t.id + '" aria-pressed="' + active + '"' +
      ' style="--accent:' + c.accent + ';--muted:' + c.muted + '">' +
      '<span class="tpl-prev" style="background:' + c.bg + ';color:' + c.text + '">' +
      '<span class="tpl-dc" style="color:' + c.primary + '">' + DV.renderDecor(t.decor.top || t.decor.divider) + '</span>' +
      '<span class="tpl-names" style="font-family:' + esc(DV.fontStack(t.fonts.script, 'script')) + '">' + esc(names) + '</span>' +
      '<span class="tpl-date" style="font-family:' + esc(DV.fontStack(t.fonts.heading, 'serif')) + ';color:' + c.primary + '">' + esc(DV.t(S().lang, 'kicker')) + '</span>' +
      (active ? '<span class="tpl-check">' + icon('check') + '</span>' : '') +
      '</span><span class="tpl-meta"><strong>' + esc(t.name) + '</strong><span>' + esc(t.desc) + '</span>' +
      '<span class="tpl-sw">' + [c.bg, c.primary, c.accent, c.text].map(function (x) { return '<i style="background:' + x + '"></i>'; }).join('') + '</span></span></button>';
  }

  function fontOptions(cat, tplFont) {
    var groups = [{ group: 'El yazısı', cat: 'script' }, { group: 'Serif', cat: 'serif' }, { group: 'Sans', cat: 'sans' }];
    var out = [['', 'Şablona göre (' + tplFont + ')']];
    groups.sort(function (a, b) { return a.cat === cat ? -1 : b.cat === cat ? 1 : 0; });
    groups.forEach(function (g) {
      out.push({ group: g.group, items: DV.fonts.filter(function (f) { return f.cat === g.cat; }).map(function (f) { return [f.name, f.name]; }) });
    });
    return out;
  }

  ed.tab('tasarim', {
    label: 'Tasarım', icon: 'flower', title: 'Tasarım', section: 'hero',
    desc: 'Şablon seçin, sonra renkleri, yazı tiplerini, efektleri ve bölüm sırasını dilediğiniz gibi ayarlayın.',
    render: function () {
      var s = S(), d = s.design;
      var R = DV.resolveDesign(s);
      DV.loadFonts(DV.TEMPLATES.reduce(function (a, t) { return a.concat([t.fonts.script, t.fonts.heading]); }, []));
      DV.loadFonts([R.fonts.script, R.fonts.heading, R.fonts.body]);

      var tpls = '<div class="tpl-grid">' + DV.TEMPLATES.map(tplCard).join('') + '</div>';

      var heroOpts = [['', 'Şablona göre (' + labelOf(DV.HERO_LAYOUTS, R.tpl.hero) + ')']].concat(DV.HERO_LAYOUTS.map(function (x) { return [x.id, x.label]; }));
      var evOpts = [['', 'Şablona göre (' + labelOf(DV.EVENT_LAYOUTS, R.tpl.events) + ')']].concat(DV.EVENT_LAYOUTS.map(function (x) { return [x.id, x.label]; }));
      var fxOpts = DV.EFFECTS.map(function (x) { return [x.id, x.id === 'auto' ? 'Şablona göre (' + labelOf(DV.EFFECTS, R.tpl.effect) + ')' : x.label]; });

      var layout =
        F.row(F.select('design.hero', 'Kapak düzeni', heroOpts, { rerender: true }), F.select('design.eventsLayout', 'Etkinlik görünümü', evOpts)) +
        F.row(F.select('design.effect', 'Hareketli efekt', fxOpts), F.select('design.photoFilter', 'Fotoğraf filtresi', [['', 'Yok'], ['bw', 'Siyah-beyaz'], ['sepia', 'Nostaljik'], ['soft', 'Yumuşak']])) +
        '<div class="sw-col">' +
        F.check('design.envelope', 'Zarf açılış animasyonu', { hint: 'Davetiye, mühürlü bir zarfın açılmasıyla başlar.' }) +
        F.check('design.groupByCity', 'Farklı şehirlerdeki etkinlikleri şehre göre grupla') +
        F.check('design.credit', 'Alt bilgide "Dijital Davetiye ile hazırlandı" yazısı') +
        '</div><div class="btns"><button type="button" class="btn-s" data-action="pv-envelope">' + icon('play') + ' Zarfı önizlemede oynat</button></div>';

      var colors = '<div class="clr-grid">' + [['bg', 'Arka plan'], ['text', 'Yazı'], ['primary', 'Ana renk'], ['accent', 'Vurgu']].map(function (x) {
        var k = x[0], over = R.overridden[k];
        return '<label class="clr"><input type="color" value="' + esc(R.colors[k]) + '" data-hook="color" data-key="' + k + '"><span><b>' + x[1] + '</b><code>' + esc(R.colors[k]) + '</code></span>' +
          (over ? '<button type="button" class="lnk" data-action="color-reset" data-key="' + k + '">Şablona dön</button>' : '<em>şablon</em>') + '</label>';
      }).join('') + '</div>' +
        '<p class="sub">Hazır paletler</p><div class="pal-grid">' + PALETTES.map(function (p, i) {
          return '<button type="button" class="pal" data-action="palette" data-i="' + i + '"><span>' + [p.c.bg, p.c.primary, p.c.accent, p.c.text].map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span>' + esc(p.name) + '</button>';
        }).join('') + '</div>';

      var fonts =
        F.select('design.fonts.script', 'İsimler (el yazısı)', fontOptions('script', R.tpl.fonts.script), { rerender: true }) +
        '<p class="font-sample" style="font-family:' + esc(DV.fontStack(R.fonts.script, 'script')) + ';font-size:2rem">' + esc(DV.coupleNames(s) || 'Elif & Can') + '</p>' +
        F.select('design.fonts.heading', 'Başlıklar', fontOptions('serif', R.tpl.fonts.heading), { rerender: true }) +
        '<p class="font-sample" style="font-family:' + esc(DV.fontStack(R.fonts.heading, 'serif')) + ';font-size:1.4rem">Düğün Programı · Şükran Günü</p>' +
        F.select('design.fonts.body', 'Metinler', fontOptions('sans', R.tpl.fonts.body), { rerender: true }) +
        '<p class="font-sample" style="font-family:' + esc(DV.fontStack(R.fonts.body, 'sans')) + '">Çiğdem, ılık şafakta öğle güneşini İzmir\'de gördü.</p>';

      var secs = '<ol class="secs">' + d.sections.map(function (sec, i) {
        var label = DV.SECTIONS.filter(function (x) { return x.id === sec.id; })[0].label;
        return '<li class="' + (sec.on ? '' : 'off') + '"><label class="sw sm"><input type="checkbox" data-bind="design.sections.' + i + '.on"><span class="sw-ui"></span><span class="sw-l">' + esc(label) + '</span></label>' +
          '<div class="it-tools"><button type="button" class="ib" data-action="list-up" data-path="design.sections" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' title="Yukarı">' + icon('chevron', 'rot180') + '</button>' +
          '<button type="button" class="ib" data-action="list-down" data-path="design.sections" data-i="' + i + '"' + (i === d.sections.length - 1 ? ' disabled' : '') + ' title="Aşağı">' + icon('chevron') + '</button></div></li>';
      }).join('') + '</ol>';

      return card('Şablon', tpls, { icon: 'star', desc: DV.TEMPLATES.length + ' şablon. Şablon değiştirdiğinizde özel renk ve yazı tipi seçimleriniz sıfırlanır.' }) +
        card('Düzen & efektler', layout, { icon: 'sparkle' }) +
        card('Renkler', colors, { icon: 'flower' }) +
        card('Yazı tipleri', fonts, { icon: 'pen', desc: 'Tüm yazı tipleri Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) destekler.' }) +
        card('Bölümler', secs, { icon: 'info', desc: 'Kapak her zaman en üsttedir. Diğer bölümleri sıralayın veya gizleyin.' });
    }
  });

  function labelOf(list, id) {
    var x = list.filter(function (i) { return i.id === id; })[0];
    return x ? x.label : id;
  }

  A.tpl = function (el) {
    var d = S().design;
    d.template = el.getAttribute('data-id');
    d.colors = { bg: '', text: '', primary: '', accent: '' };
    d.fonts = { script: '', heading: '', body: '' };
    d.hero = '';
    d.eventsLayout = '';
    d.effect = 'auto';
    ed.changed({ rerender: true });
    ed.scrollPreview('hero');
  };

  ed.hooks.color = function (el) {
    S().design.colors[el.getAttribute('data-key')] = el.value;
    ed.changed({ rerender: true });
  };
  // Renk seçerken canlı önizleme (input olayı)
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.getAttribute && el.getAttribute('data-hook') === 'color') {
      S().design.colors[el.getAttribute('data-key')] = el.value;
      var code = el.parentNode.querySelector('code');
      if (code) code.textContent = el.value;
      ed.pushPreview();
    }
  });

  A['color-reset'] = function (el) {
    S().design.colors[el.getAttribute('data-key')] = '';
    ed.changed({ rerender: true });
  };

  A.palette = function (el) {
    var p = PALETTES[+el.getAttribute('data-i')];
    S().design.colors = DV.clone(p.c);
    ed.changed({ rerender: true });
    ed.toast('"' + p.name + '" paleti uygulandı');
  };
})();
