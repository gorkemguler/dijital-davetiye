/**
 * Dijital Davetiye — site ayarları
 * Projeyi fork'ladıktan sonra yalnızca bu dosyayı düzenlemeniz yeterli.
 */
window.DV_SITE = {
  /**
   * Ana sayfada (index.html) ne gösterilsin?
   *   'landing' → tanıtım sayfası (varsayılan)
   *   'invite'  → doğrudan davetiyeniz (defaultInvitation)
   *   'editor'  → davetiye editörü
   */
  home: 'landing',

  /** invitations/ klasöründeki varsayılan davetiye (uzantısız dosya adı) */
  defaultInvitation: 'ornek',

  /**
   * Sitenizin yayın adresi. Editör paylaşım bağlantılarını bu adrese göre üretir.
   * Örnek: 'https://kullaniciadi.github.io/dijital-davetiye/'
   * Boş bırakılırsa editörün açıldığı adres kullanılır.
   */
  baseUrl: '',

  /** Davetiye altındaki "Dijital Davetiye ile hazırlandı" bağlantısı (boş bırakılabilir) */
  repoUrl: 'https://github.com/gorkemguler/dijital-davetiye'
};
