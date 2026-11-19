// Denetleyicilerin ortak girdi kontrolleri. Geçersiz girdide 400 hatası fırlatır.
const { UygulamaHatasi } = require('../hatalar');

function pozitifTamsayi(deger, alanAdi) {
  const sayi = Number(deger);
  if (!Number.isInteger(sayi) || sayi <= 0) {
    throw new UygulamaHatasi(400, `${alanAdi} geçersiz.`);
  }
  return sayi;
}

function tarih(deger, alanAdi = 'Tarih') {
  if (typeof deger !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deger)) {
    throw new UygulamaHatasi(400, `${alanAdi} YYYY-AA-GG biçiminde olmalıdır.`);
  }
  return deger;
}

module.exports = { pozitifTamsayi, tarih };
