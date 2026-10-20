# Katkıda bulunma

Dijital Davetiye'ye katkı yapmak istediğiniz için teşekkürler! 💌

## Temel ilkeler

- **Derleme adımı yok.** Proje saf HTML/CSS/JS'tir; herkes fork'layıp doğrudan GitHub Pages'te yayınlayabilmelidir. npm paketi, bundler veya framework eklemeyin.
- **Klasik script'ler.** `core.js`, `templates.js` ve `invite.js` "tek dosya HTML" dışa aktarımında `<script>` içine gömülür. Bu yüzden:
  - ES modülü (`import`/`export`) kullanmayın; her şey `window.DV` ad alanında.
  - Kod içinde kapanış script etiketi metni geçmesin.
- **Geniş tarayıcı desteği.** Misafirlerin bir kısmı eski telefonlar kullanır. Mevcut kodun stiline (ES5 benzeri, `var`, fonksiyonlar) uyun.
- **Kullanıcı verisi güvenilmezdir.** Paylaşım bağlantıları herkes tarafından üretilebilir. HTML'e yazılan her metni `DV.esc()` ile, her bağlantıyı `DV.safeUrl()` ile geçirin.
- **Türkçe öncelikli.** Editör arayüzü Türkçedir. Davetiye metinleri `DV.i18n` içinde Türkçe ve İngilizce tutulur; yeni bir metin eklerseniz iki dile de ekleyin.

## Geliştirme ortamı

```bash
python3 -m http.server 8000
# http://localhost:8000/editor.html
```

## Katkı fikirleri

- 🎨 Yeni şablonlar → [docs/sablon-ekleme.md](docs/sablon-ekleme.md)
- 🌍 Yeni davetiye dilleri (`DV.i18n` + `DV.EVENT_TYPES`)
- 🧩 Yeni etkinlik türleri ve hazır senaryolar (`DV.EVENT_TYPES`, `DV.PRESETS`)
- ♿ Erişilebilirlik iyileştirmeleri
- 🐛 Hata düzeltmeleri

## Pull request öncesi kontrol listesi

- [ ] Telefon (375 px) ve masaüstü genişliğinde test ettim
- [ ] Editör, önizleme, paylaşım bağlantısı ve tek dosya HTML dışa aktarımı çalışıyor
- [ ] Tarayıcı konsolunda hata yok
- [ ] Türkçe karakterler doğru görünüyor
