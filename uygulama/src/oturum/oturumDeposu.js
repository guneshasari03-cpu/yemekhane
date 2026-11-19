// =====================================================================
// Oturum deposu · Aşama 2: uygulamanın belleğinde (Map)
// Dezavantajı: uygulama container'ı yeniden başlarsa tüm oturumlar düşer.
// Aşama 3'te aynı fonksiyonlar Redis ile yeniden yazılacak; uygulamanın
// geri kalanı değişmeyecek.
// =====================================================================
const crypto = require('crypto');
const ayar = require('../yapilandirma');

const oturumlar = new Map();   // token -> { kullanici, bitis }

async function olustur(kullanici) {
  const token = crypto.randomBytes(32).toString('hex');
  oturumlar.set(token, { kullanici, bitis: Date.now() + ayar.oturumSuresiSn * 1000 });
  return token;
}

// Oturumu getirir ve süresini 30 dakika uzatır (kayan süre).
async function getir(token) {
  const kayit = oturumlar.get(token);
  if (!kayit) return null;
  if (kayit.bitis < Date.now()) {
    oturumlar.delete(token);
    return null;
  }
  kayit.bitis = Date.now() + ayar.oturumSuresiSn * 1000;
  return kayit.kullanici;
}

async function sil(token) {
  oturumlar.delete(token);
}

module.exports = { olustur, getir, sil };
