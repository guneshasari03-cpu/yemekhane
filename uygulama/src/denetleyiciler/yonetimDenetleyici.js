// Yönetici paneli uç noktaları (rotada girisGerekli + yoneticiGerekli ile korunur).
const yonetimDeposu = require('../veri/yonetimDeposu');
const yonetimServisi = require('../servisler/yonetimServisi');
const dogrula = require('./dogrula');
const { UygulamaHatasi } = require('../hatalar');

// GET /api/yonetim/menuler?baslangic=...&bitis=...[&yemekhane=1]
async function menuRaporu(req, res) {
  const baslangic = dogrula.tarih(req.query.baslangic, 'Başlangıç');
  const bitis = dogrula.tarih(req.query.bitis, 'Bitiş');
  const yemekhaneId = req.query.yemekhane ? dogrula.pozitifTamsayi(req.query.yemekhane, 'Yemekhane') : null;
  res.json(await yonetimDeposu.menuRaporu(yemekhaneId, baslangic, bitis));
}

// GET /api/yonetim/yemekler
async function yemekler(req, res) {
  const satirlar = await yonetimDeposu.yemekler();
  res.json(satirlar.map((y) => ({ ...y, vejetaryen: y.vejetaryen === 1 })));
}

// GET /api/yonetim/menuler/:id
async function menuGetir(req, res) {
  const menuId = dogrula.pozitifTamsayi(req.params.id, 'Menü');
  const menu = await yonetimDeposu.menuGetir(menuId);
  if (!menu) throw new UygulamaHatasi(404, 'Menü bulunamadı.');
  res.json(menu);
}

// POST /api/yonetim/menuler
async function menuOlustur(req, res) {
  res.status(201).json(await yonetimServisi.menuOlustur(req.body));
}

// PUT /api/yonetim/menuler/:id
async function menuGuncelle(req, res) {
  const menuId = dogrula.pozitifTamsayi(req.params.id, 'Menü');
  res.json(await yonetimServisi.menuGuncelle(menuId, req.body));
}

module.exports = { menuRaporu, yemekler, menuGetir, menuOlustur, menuGuncelle };
