// Oturum kontrolü (middleware). Token, HttpOnly çerezde taşınır.
const ayar = require('../yapilandirma');
const oturumDeposu = require('../oturum/oturumDeposu');
const { UygulamaHatasi } = require('../hatalar');

function cerezOku(req, ad) {
  const baslik = req.headers.cookie || '';
  for (const parca of baslik.split(';')) {
    const [anahtar, ...deger] = parca.trim().split('=');
    if (anahtar === ad) return decodeURIComponent(deger.join('='));
  }
  return null;
}

// Oturum yoksa 401 döner; varsa req.kullanici ve req.token doldurulur.
async function girisGerekli(req, res, next) {
  const token = cerezOku(req, ayar.oturumCerezAdi);
  const kullanici = token ? await oturumDeposu.getir(token) : null;
  if (!kullanici) throw new UygulamaHatasi(401, 'Oturum açmanız gerekiyor.');
  req.kullanici = kullanici;
  req.token = token;
  next();
}

function yoneticiGerekli(req, res, next) {
  if (req.kullanici.rol !== 'yonetici') {
    throw new UygulamaHatasi(403, 'Bu işlem için yönetici yetkisi gerekiyor.');
  }
  next();
}

module.exports = { girisGerekli, yoneticiGerekli };
