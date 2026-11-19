// Menü ekranlarının uç noktaları. Burada SQL yoktur; veri servis/depo katmanından gelir.
const menuDeposu = require('../veri/menuDeposu');
const menuServisi = require('../servisler/menuServisi');
const dogrula = require('./dogrula');
const { UygulamaHatasi } = require('../hatalar');

// GET /api/yemekhaneler
async function yemekhaneler(req, res) {
  res.json(await menuDeposu.yemekhaneler());
}

// GET /api/ogunler
async function ogunler(req, res) {
  res.json(await menuDeposu.ogunler());
}

// GET /api/menu?yemekhane=1&tarih=2026-11-18&ogun=2   (günün menüsü)
async function gunluk(req, res) {
  const yemekhaneId = dogrula.pozitifTamsayi(req.query.yemekhane, 'Yemekhane');
  const tarih = dogrula.tarih(req.query.tarih);
  const ogunId = dogrula.pozitifTamsayi(req.query.ogun, 'Öğün');

  const menu = await menuServisi.menuGetir(yemekhaneId, tarih, ogunId);
  if (!menu) throw new UygulamaHatasi(404, 'Bu yemekhane, tarih ve öğün için menü bulunamadı.');

  res.json({ ...menu, ...menuServisi.fiyatSec(req.kullanici.rol, menu) });
}

module.exports = { yemekhaneler, ogunler, gunluk };
