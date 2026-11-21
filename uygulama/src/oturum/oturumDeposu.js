// =====================================================================
// Oturum deposu · Aşama 3: Redis
//   Anahtar : oturum:{token}
//   Değer   : oturumdaki kullanıcı (JSON)
//   Süre    : 30 dakika, her istekte yenilenir (kayan süre)
//   Silinme : çıkış yapıldığında
// Oturum uygulamanın belleğinde değil Redis'te tutulduğu için uygulama
// container'ı yeniden başlasa da kullanıcı oturumdan düşmez.
// (Aşama 2'de burada bir Map vardı; fonksiyon imzaları aynı kaldı.)
// =====================================================================
const crypto = require('crypto');
const ayar = require('../yapilandirma');
const istemci = require('../redisIstemci');

const anahtar = (token) => `oturum:${token}`;
const TOKEN_BICIMI = /^[a-f0-9]{64}$/;

async function olustur(kullanici) {
  const token = crypto.randomBytes(32).toString('hex');
  await istemci.set(anahtar(token), JSON.stringify(kullanici), 'EX', ayar.oturumSuresiSn);
  return token;
}

// Oturumu getirir ve süresini yeniden 30 dakikaya çeker.
// GETEX okuma ile süre yenilemeyi tek komutta (atomik) yapar.
async function getir(token) {
  if (!TOKEN_BICIMI.test(token)) return null;
  const deger = await istemci.getex(anahtar(token), 'EX', ayar.oturumSuresiSn);
  return deger ? JSON.parse(deger) : null;
}

async function sil(token) {
  await istemci.del(anahtar(token));
}

module.exports = { olustur, getir, sil };
