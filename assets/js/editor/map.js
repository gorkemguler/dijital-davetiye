/*!
 * Dijital Davetiye — haritadan konum seçici
 * Harita: Leaflet + OpenStreetMap · Arama: Nominatim (API anahtarı gerekmez)
 * MIT Lisansı
 */
(function () {
  'use strict';

  var DV = window.DV, ed = DV.ed, esc = DV.esc, icon = DV.icon;

  var NOMINATIM = 'https://nominatim.openstreetmap.org/';
  var lastReq = 0;

  /** Nominatim kullanım kuralı: saniyede en fazla 1 istek. */
  function nominatim(path, params) {
    var wait = Math.max(0, 1100 - (Date.now() - lastReq));
    return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
      lastReq = Date.now();
      var q = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
      return fetch(NOMINATIM + path + '?format=jsonv2&addressdetails=1&accept-language=tr&' + q, { headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('Arama servisi yanıt vermedi (' + r.status + ')'); return r.json(); });
    });
  }

  /** Nominatim adresini "adres" ve "şehir" alanlarına ayırır (Türkiye'de il = province). */
  function splitAddress(a) {
    a = a || {};
    var city = a.province || a.state || a.city || '';
    var district = a.town || a.county || a.city_district || a.district || '';
    if (district === city) district = '';
    var street = [a.neighbourhood || a.suburb || a.quarter || a.village, a.road, a.house_number].filter(Boolean).join(' ');
    return { city: city, address: [street, district].filter(Boolean).join(', ') };
  }

  function placeInfo(r) {
    var parts = splitAddress(r.address);
    var name = r.name && r.name !== parts.city && !/^\d+$/.test(r.name) ? r.name : '';
    return { name: name, address: parts.address, city: parts.city, label: r.display_name || '' };
  }

  function round(n) { return Math.round(n * 1e6) / 1e6; }

  ed.actions['loc-pick'] = function (el) {
    pick(ed.state.events[+el.getAttribute('data-i')]);
  };

  function pick(ev) {
    var sel = DV.hasCoords(ev) ? { lat: ev.lat, lng: ev.lng } : null;
    var found = null, map = null, marker = null, L = null, fill = true;
    var q0 = [ev.venue, ev.city].filter(Boolean).join(', ');

    ed.modal({
      title: 'Konum seç — ' + DV.eventName(ev, 'tr'),
      wide: true,
      noAutofocus: true,
      body:
        '<div class="mp">' +
        '<form class="mp-search" autocomplete="off"><input type="search" name="q" placeholder="Mekan veya adres arayın (ör. Çırağan Sarayı, Beşiktaş)" value="' + esc(q0) + '">' +
        '<button class="btn-s primary" type="submit">' + icon('nav') + ' Ara</button>' +
        '<button class="btn-s" type="button" data-mp="geo" title="Bulunduğum konumu kullan">' + icon('pin') + '</button></form>' +
        '<div class="mp-results" hidden></div>' +
        '<div class="mp-map"><div class="mp-loading">Harita yükleniyor…</div></div>' +
        '<p class="mp-info">' + icon('info') + '<span>Haritaya tıklayarak veya işaretçiyi sürükleyerek tam giriş kapısını işaretleyin.</span></p>' +
        '<label class="sw sm"><input type="checkbox" data-mp="fill" checked><span class="sw-ui"></span><span class="sw-l">Boş olan mekan adı, adres ve şehir alanlarını otomatik doldur</span></label>' +
        '</div>',
      actions: [
        { label: 'Vazgeç', value: false },
        {
          label: 'Konumu kaydet', primary: true, value: true,
          onClick: function (m) {
            if (!sel) { ed.toast('Önce haritada bir nokta seçin', 'err'); return false; }
            fill = m.querySelector('[data-mp="fill"]').checked;
          }
        }
      ],
      onOpen: function (m) {
        var info = m.querySelector('.mp-info span');
        var results = m.querySelector('.mp-results');
        var form = m.querySelector('.mp-search');
        var box = m.querySelector('.mp-map');

        function setInfo(text) { info.textContent = text; }

        function setMarker(ll, zoom) {
          sel = { lat: ll.lat, lng: ll.lng };
          if (!map) return;
          if (!marker) {
            marker = L.marker(ll, {
              draggable: true,
              icon: L.divIcon({ className: '', html: '<div class="dv-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] })
            }).addTo(map);
            marker.on('dragend', function () {
              var p = marker.getLatLng();
              sel = { lat: p.lat, lng: p.lng };
              reverse(sel);
            });
          } else {
            marker.setLatLng(ll);
          }
          if (zoom) map.setView(ll, zoom);
        }

        var reverse = DV.debounce(function (ll) {
          setInfo('Adres aranıyor…');
          nominatim('reverse', { lat: ll.lat, lon: ll.lng, zoom: 18 }).then(function (r) {
            found = placeInfo(r);
            setInfo('Seçilen: ' + (found.label || (round(ll.lat) + ', ' + round(ll.lng))));
          }).catch(function () {
            found = null;
            setInfo('Seçilen konum: ' + round(ll.lat) + ', ' + round(ll.lng));
          });
        }, 400);

        function search(q) {
          if (!q) return;
          results.hidden = false;
          results.innerHTML = '<p class="mp-empty">Aranıyor…</p>';
          nominatim('search', { q: q, limit: 6 }).then(function (list) {
            if (!list.length) { results.innerHTML = '<p class="mp-empty">Sonuç bulunamadı. Daha genel yazmayı deneyin veya haritaya tıklayın.</p>'; return; }
            results.innerHTML = list.map(function (r, i) {
              return '<button type="button" class="mp-r" data-r="' + i + '">' + icon('pin') + '<span><b>' + esc(r.name || r.display_name.split(',')[0]) + '</b><small>' + esc(r.display_name) + '</small></span></button>';
            }).join('');
            results._list = list;
          }).catch(function (e) {
            results.innerHTML = '<p class="mp-empty">' + esc(e.message) + '</p>';
          });
        }

        results.addEventListener('click', function (e) {
          var b = e.target.closest('[data-r]');
          if (!b) return;
          var r = results._list[+b.getAttribute('data-r')];
          found = placeInfo(r);
          setMarker({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) }, 17);
          setInfo('Seçilen: ' + r.display_name + ' — gerekirse işaretçiyi tam girişe sürükleyin.');
          results.hidden = true;
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          search(form.q.value.trim());
        });

        m.querySelector('[data-mp="geo"]').addEventListener('click', function () {
          if (!navigator.geolocation) { ed.toast('Tarayıcınız konum desteği sunmuyor', 'err'); return; }
          setInfo('Konumunuz alınıyor…');
          navigator.geolocation.getCurrentPosition(function (p) {
            var ll = { lat: p.coords.latitude, lng: p.coords.longitude };
            setMarker(ll, 17);
            reverse(ll);
          }, function () { setInfo('Konum izni verilmedi.'); }, { enableHighAccuracy: true, timeout: 10000 });
        });

        DV.loadLeaflet().then(function (lib) {
          L = lib;
          box.innerHTML = '';
          map = L.map(box, { zoomControl: true }).setView(sel ? [sel.lat, sel.lng] : [39.1, 35.2], sel ? 17 : 5);
          DV.tileLayer(L).addTo(map);
          if (sel) setMarker(sel);
          map.on('click', function (e) {
            setMarker(e.latlng);
            reverse(sel);
          });
          setTimeout(function () { map.invalidateSize(); }, 80);
          m._map = map;
          if (!sel && q0) search(q0);
        }).catch(function () {
          box.innerHTML = '<div class="mp-loading">Harita yüklenemedi. İnternet bağlantınızı kontrol edin.</div>';
        });
      }
    }).then(function (ok) {
      if (map) map.remove();
      if (!ok || !sel) return;
      ev.lat = round(sel.lat);
      ev.lng = round(sel.lng);
      if (fill && found) {
        if (!ev.venue && found.name) ev.venue = found.name;
        if (!ev.address && found.address) ev.address = found.address;
        if (!ev.city && found.city) ev.city = found.city;
      }
      ed.changed({ rerender: true });
      ed.toast('Konum kaydedildi');
    });
  }
})();
