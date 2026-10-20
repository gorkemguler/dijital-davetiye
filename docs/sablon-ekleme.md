# Yeni şablon ekleme

Bir şablon iki parçadan oluşur:

1. **Kayıt** — `assets/js/templates.js` içindeki `DV.TEMPLATES` listesine eklenen bir nesne (renkler, yazı tipleri, düzen, süslemeler, efekt).
2. **Stil** — `templates/<id>.css` dosyası (arka plan dokusu, kart stilleri, şablona özel dokunuşlar).

Derleme adımı yoktur; dosyaları kaydedip sayfayı yenilemeniz yeterli.

## 1. Kaydı ekleyin

```js
{
  id: 'zumrut',                       // dosya adıyla aynı: templates/zumrut.css
  name: 'Zümrüt',                     // editörde görünen ad
  desc: 'Koyu yeşil ve altın, lüks bir gece düğünü',
  colors: {
    bg: '#0f2a22',       // sayfa arka planı
    surface: '#143529',  // kartlar
    text: '#f2ead8',     // yazı
    muted: '#a9b5a6',    // ikincil yazı
    primary: '#c9a35d',  // ana renk (butonlar, süslemeler)
    accent: '#e6d3a3'    // vurgu
  },
  fonts: { script: 'Pinyon Script', heading: 'Cinzel', body: 'Raleway' },
  hero: 'circle',        // frame | arch | circle | full | split
  events: 'cards',       // cards | timeline
  effect: 'sparkle',     // none | sparkle | petals | leaves | stars | snow | hearts | confetti | fireflies
  dark: true,            // koyu şablonlarda harita karoları koyulaştırılır
  decor: {
    top: 'oliveTop',       // kapakta isimlerin üstü
    divider: 'oliveSprig', // başlıkların altındaki ayraç
    corner: 'goldCorner'   // kapak köşeleri (isteğe bağlı)
  }
}
```

- **Yazı tipleri** `assets/js/core.js` içindeki `DV.fonts` listesinden seçilmelidir (hepsi Türkçe karakter destekli). Yeni yazı tipi ekleyecekseniz Google Fonts'ta **latin-ext** alt kümesi olduğundan emin olun ve `DV.fonts`'a ekleyin.
- **Süslemeler** `DV.decor` içindeki fonksiyonlardır: `flourishTop`, `flourish`, `goldCorner`, `line`, `eucalyptusTop`, `eucalyptusCorner`, `sprig`, `oliveTop`, `oliveSprig`, `starsTop`, `starLine`, `floralTop`, `floralCorner`, `flowerLine`, `tulipTop`, `tulipLine`, `archesTop`, `bohoLine`, `decoFan`, `decoCorner`, `decoLine`, `snowTop`, `snowLine`, `lightsTop`, `heartLine`, `lavenderTop`, `lavenderLine`.

### Yeni süsleme yazmak

`DV.decor.benimSuslemem = function () { return svg('0 0 240 30', '...'); };`

- `currentColor` → şablonun **ana rengi** (`--primary`) olur.
- `style="fill:var(--accent)"` → **vurgu rengi**.
- Kullanıcı renkleri değiştirdiğinde süslemeler de otomatik değişir.
- Yardımcılar: `branch()` (eğri boyunca yapraklı dal), `flower()`, `tulip()`, `snowflake()`, `lavender()`, `star4()`.

## 2. CSS dosyasını oluşturun

Renkler ve yazı tipleri JavaScript tarafından CSS değişkenleri olarak atanır; CSS dosyanızda **renk kodu yazmak yerine değişkenleri kullanın** ki kullanıcının renk seçimleri çalışsın:

| Değişken | Anlamı |
|---|---|
| `--bg`, `--surface`, `--text`, `--muted`, `--primary`, `--accent`, `--on-primary` | Renkler |
| `--line`, `--line-soft`, `--soft` | Ana renkten türetilmiş çizgi ve zemin tonları |
| `--f-script`, `--f-head`, `--f-body` | Yazı tipleri |
| `--radius`, `--btn-radius`, `--shadow` | Köşe yuvarlaklığı ve gölge |
| `--names-size`, `--head-size`, `--head-weight`, `--head-transform`, `--head-spacing`, `--kicker-spacing` | Tipografi |

Tüm seçicileri şablonunuzla sınırlayın:

```css
/* templates/zumrut.css */
body.dv[data-tpl="zumrut"] {
  --radius: 4px;
  --head-transform: uppercase;
  --head-spacing: .16em;
  background-image: radial-gradient(ellipse at top, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%);
}
[data-tpl="zumrut"] .names .amp { font-family: var(--f-head); }
[data-tpl="zumrut"] .ev { border: 1px solid var(--primary); }
```

Sık kullanılan sınıflar: `.hero`, `.hero-inner`, `.names`, `.kicker`, `.hero-date`, `.dc-top`, `.dc-divider`, `.dc-corner.tl|tr|bl|br`, `.sec`, `.sec-title`, `.ev`, `.ev-icon`, `.ev-datebox`, `.cd-u`, `.rsvp-card`, `.info-card`, `.btn`, `.env-*` (zarf).

## 3. Deneyin

```
davetiye.html?d=ornek&t=zumrut
```

Kontrol listesi:

- [ ] Telefon (375 px) ve masaüstünde düzgün görünüyor
- [ ] Türkçe karakterler (ğ, ş, ı, İ) doğru
- [ ] Zarf açılışı ve tüm bölümler (geri sayım, etkinlikler, LCV, galeri) okunaklı
- [ ] Editörde renkleri değiştirince şablon bozulmuyor
- [ ] Şablon editördeki galeride doğru görünüyor
