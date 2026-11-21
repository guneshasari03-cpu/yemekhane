// Rezervasyon uç noktaları. İş kuralları (süre, kapasite, bakiye) yordamlardadır;
// yordamın Türkçe hata mesajı hataYakala üzerinden olduğu gibi arayüze gider.
const rezervasyonDeposu = require('../veri/rezervasyonDeposu');
const dogrula = require('./dogrula');

// POST /api/rezervasyonlar  { menu_id, porsiyon: 'tam' | 'yarim' }
async function olustur(req, res) {
  const menuId = dogrula.pozitifTamsayi(req.body?.menu_id, 'Menü');
  // Porsiyon verilmezse tam; geçersiz değeri ve kahvaltıda yarımı yordam reddeder
  const porsiyon = String(req.body?.porsiyon ?? 'tam');
  const sonuc = await rezervasyonDeposu.rezervasyonYap(req.kullanici.id, menuId, porsiyon);
  // sonuc.bakiye yordamın kaynakta hesapladığı güncel bakiyedir
  res.status(201).json(sonuc);
}

// GET /api/rezervasyonlar
async function listele(req, res) {
  const satirlar = await rezervasyonDeposu.kullanicininRezervasyonlari(req.kullanici.id);
  res.json(satirlar.map((s) => ({
    ...s,
    iptal_edilebilir: s.iptal_edilebilir === 1,
    degerlendirilebilir: s.degerlendirilebilir === 1,
  })));
}

// DELETE /api/rezervasyonlar/:id
async function iptal(req, res) {
  const rezervasyonId = dogrula.pozitifTamsayi(req.params.id, 'Rezervasyon');
  const sonuc = await rezervasyonDeposu.iptalEt(req.kullanici.id, rezervasyonId);
  res.json(sonuc);
}

module.exports = { olustur, listele, iptal };
