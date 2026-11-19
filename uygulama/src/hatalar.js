// Uygulamanın kendi ürettiği, kullanıcıya gösterilebilir hatalar.
// durum: HTTP durum kodu (400 geçersiz istek, 401 oturum yok, 403 yetki yok, 404 bulunamadı)
class UygulamaHatasi extends Error {
  constructor(durum, mesaj) {
    super(mesaj);
    this.durum = durum;
  }
}

module.exports = { UygulamaHatasi };
