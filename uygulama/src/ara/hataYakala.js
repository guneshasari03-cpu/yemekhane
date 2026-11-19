// Tüm hataların tek bir yerde JSON'a çevrildiği middleware.
const { UygulamaHatasi } = require('../hatalar');

const MYSQL_SIGNAL = 1644;        // stored procedure'ün SIGNAL SQLSTATE '45000' hatası
const MYSQL_TEKRAR_KAYIT = 1062;  // UNIQUE ihlali
const MYSQL_CHECK = 3819;         // CHECK kısıtı ihlali (programlama hatası)

// eslint-disable-next-line no-unused-vars
function hataYakala(hata, req, res, next) {
  // 1) Uygulamanın kendi hataları: mesaj olduğu gibi
  if (hata instanceof UygulamaHatasi) {
    return res.status(hata.durum).json({ hata: hata.message });
  }

  // 2) Yordamların Türkçe hata mesajları: DEĞİŞTİRİLMEDEN arayüze iletilir
  if (hata.errno === MYSQL_SIGNAL || hata.sqlState === '45000') {
    return res.status(400).json({ hata: hata.sqlMessage || hata.message });
  }

  // 3) Bozuk JSON gövdesi
  if (hata.type === 'entity.parse.failed') {
    return res.status(400).json({ hata: 'İstek gövdesi geçerli JSON değil.' });
  }

  // 4) Tekrar kayıt: denetleyici özel mesaj vermediyse genel mesaj
  if (hata.errno === MYSQL_TEKRAR_KAYIT) {
    return res.status(409).json({ hata: 'Bu kayıt zaten mevcut.' });
  }

  // 5) CHECK ihlali ve diğer her şey: ham mesaj kullanıcıya gösterilmez, günlüğe yazılır
  if (hata.errno === MYSQL_CHECK) {
    console.error('[HATA] CHECK kısıtı ihlali (programlama hatası):', hata.sqlMessage);
  } else {
    console.error('[HATA]', hata);
  }
  return res.status(500).json({ hata: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' });
}

module.exports = { hataYakala, MYSQL_TEKRAR_KAYIT };
