# LCV yanıtlarını Google E-Tablolar'a kaydetme

Bu yöntemle misafirlerin davetiyeden gönderdiği her katılım bildirimi otomatik olarak bir Google E-Tablosuna satır olarak eklenir. Ücretsizdir ve yaklaşık 5 dakika sürer.

## 1. Tabloyu oluşturun

[sheets.new](https://sheets.new) adresinden yeni bir Google E-Tablo açın ve adını verin (ör. *Düğün LCV*).

## 2. Apps Script kodunu ekleyin

Menüden **Uzantılar → Apps Script**'e tıklayın. Açılan düzenleyicideki kodu tamamen silip aşağıdakini yapıştırın ve **Kaydet** (💾) düğmesine basın:

```js
// Dijital Davetiye — LCV yanıtlarını Google E-Tablolar'a kaydeder
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Tarih', 'Ad Soyad', 'Katılım', 'Kişi', 'Etkinlikler', 'Not', 'Grup']);
  }
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([new Date(), d.name, d.attendingText, d.count, d.events, d.note, d.group]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

> Bu kod editörde de var: **LCV → Google E-Tablolar → "5 dakikalık kurulum"** bağlantısından kopyalayabilirsiniz.

## 3. Web uygulaması olarak dağıtın

1. Sağ üstten **Dağıt → Yeni dağıtım**'a tıklayın.
2. Tür seçiminde (⚙️) **Web uygulaması**'nı seçin.
3. **Şu kullanıcı olarak yürüt:** *Ben*
4. **Erişimi olanlar:** *Herkes* ← önemli
5. **Dağıt**'a basın ve Google'ın istediği izinleri onaylayın (*Gelişmiş → … sayfasına git (güvenli değil)* uyarısı kendi yazdığınız betik için normaldir).
6. Size verilen **Web uygulaması URL'sini** kopyalayın. Şuna benzer:
   `https://script.google.com/macros/s/AKfycb…/exec`

## 4. Editöre yapıştırın

Editör → **LCV** sekmesi → *Yanıtlar nasıl toplansın?* → **Google E-Tablolar** → kopyaladığınız adresi yapıştırın.

Davetiyenizi açıp kendinize deneme yanıtı gönderin; birkaç saniye içinde tabloda görünmelidir.

## Sık karşılaşılan sorunlar

- **Yanıtlar tabloya düşmüyor:** Dağıtımda *Erişimi olanlar* seçeneğinin **Herkes** olduğundan emin olun.
- **Kodu değiştirdim ama çalışmıyor:** Apps Script'te kod değişikliğinden sonra **Dağıt → Dağıtımları yönet → Düzenle (✏️) → Sürüm: Yeni sürüm** ile tekrar dağıtmanız gerekir.
- **Davetiye "Teşekkürler" diyor ama yanıt yok:** Tarayıcı güvenlik kuralları gereği davetiye Google'ın yanıtını okuyamaz; bu yüzden hata olsa bile teşekkür mesajı görünür. URL'nin `/exec` ile bittiğini kontrol edin.

## Gelen verinin yapısı

Davetiye aşağıdaki alanları gönderir (kendi betiğinizde kullanabilirsiniz):

| Alan | Örnek |
|---|---|
| `name` | `Ahmet Yılmaz` |
| `attending` | `evet` / `hayir` |
| `attendingText` | `Katılacağım` |
| `count` | `3` |
| `events` | `Kına Gecesi, Düğün` |
| `note` | `Tebrikler!` |
| `group` | `aile` |
| `invitation` | `Elif & Can` |
| `sentAt` | `2027-05-01T12:34:56.000Z` |
