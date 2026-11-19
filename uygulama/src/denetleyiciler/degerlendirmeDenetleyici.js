// Değerlendirme ekranı uç noktaları.
const degerlendirmeDeposu = require('../veri/degerlendirmeDeposu');
const degerlendirmeServisi = require('../servisler/degerlendirmeServisi');
const dogrula = require('./dogrula');

// GET /api/degerlendirmeler -> { bekleyenler, verilenler }
async function listele(req, res) {
  const [bekleyenler, verilenler] = await Promise.all([
    degerlendirmeDeposu.bekleyenler(req.kullanici.id),
    degerlendirmeDeposu.verilenler(req.kullanici.id),
  ]);
  res.json({ bekleyenler, verilenler });
}

// POST /api/degerlendirmeler  { menu_id, puan, yorum }
async function ekle(req, res) {
  const menuId = dogrula.pozitifTamsayi(req.body?.menu_id, 'Menü');
  const sonuc = await degerlendirmeServisi.ekle(req.kullanici.id, menuId, req.body?.puan, req.body?.yorum);
  res.status(201).json(sonuc);
}

module.exports = { listele, ekle };
