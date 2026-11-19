// Bakiye ekranı uç noktaları.
const kullaniciDeposu = require('../veri/kullaniciDeposu');
const bakiyeDeposu = require('../veri/bakiyeDeposu');
const { UygulamaHatasi } = require('../hatalar');

// GET /api/bakiye  -> güncel bakiye (kaynak) + hareket geçmişi (replika)
async function ozet(req, res) {
  const [bakiye, hareketler] = await Promise.all([
    kullaniciDeposu.bakiyeGetir(req.kullanici.id),
    bakiyeDeposu.hareketler(req.kullanici.id),
  ]);
  res.json({ bakiye, hareketler });
}

// POST /api/bakiye  { tutar }
async function yukle(req, res) {
  const tutar = Number(req.body?.tutar);
  if (!Number.isFinite(tutar)) throw new UygulamaHatasi(400, 'Tutar bir sayı olmalıdır.');

  const sonuc = await bakiyeDeposu.yukle(req.kullanici.id, tutar);
  // Yeni hareket replikaya henüz geçmemiş olabilir; kaynaktan okunup yanıta eklenir
  const hareket = await bakiyeDeposu.hareketGetirKaynaktan(sonuc.hareket_id);
  res.status(201).json({ bakiye: sonuc.bakiye, hareket });
}

module.exports = { ozet, yukle };
