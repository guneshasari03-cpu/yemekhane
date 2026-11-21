// Aşama 4 · Profil ekranı uç noktaları.
const profilDeposu = require('../veri/profilDeposu');
const kullaniciDeposu = require('../veri/kullaniciDeposu');
const dogrula = require('./dogrula');
const { UygulamaHatasi } = require('../hatalar');

const MYSQL_YABANCI_ANAHTAR = 1452;

// GET /api/alerjenler
async function alerjenler(req, res) {
  res.json(await profilDeposu.alerjenler());
}

// GET /api/profil -> kullanıcı + bakiye + seçili alerjenler
async function getir(req, res) {
  const [bakiye, secili] = await Promise.all([
    kullaniciDeposu.bakiyeGetir(req.kullanici.id),
    profilDeposu.kullaniciAlerjenleri(req.kullanici.id, true),
  ]);
  res.json({ kullanici: { ...req.kullanici, bakiye }, alerjenler: secili });
}

// PUT /api/profil/alerjenler  { alerjen_idler: [1, 7] }   (boş liste: hiç alerjen yok)
async function alerjenleriKaydet(req, res) {
  const girdi = req.body?.alerjen_idler;
  if (!Array.isArray(girdi)) throw new UygulamaHatasi(400, 'Alerjen listesi gönderilmelidir.');
  const idler = [...new Set(girdi.map((id) => dogrula.pozitifTamsayi(id, 'Alerjen')))];

  try {
    await profilDeposu.alerjenleriKaydet(req.kullanici.id, idler);
  } catch (hata) {
    if (hata.errno === MYSQL_YABANCI_ANAHTAR) throw new UygulamaHatasi(400, 'Seçilen alerjenlerden biri bulunamadı.');
    throw hata;
  }
  res.json({ alerjenler: await profilDeposu.kullaniciAlerjenleri(req.kullanici.id, true) });
}

module.exports = { alerjenler, getir, alerjenleriKaydet };
