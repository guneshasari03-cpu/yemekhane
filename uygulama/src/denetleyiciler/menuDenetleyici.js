// Menü ekranlarının uç noktaları. Burada SQL yoktur; veri servis/depo katmanından gelir.
const menuDeposu = require('../veri/menuDeposu');
const menuServisi = require('../servisler/menuServisi');
const profilDeposu = require('../veri/profilDeposu');
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

  const [menu, alerjenler] = await Promise.all([
    menuServisi.menuGetir(yemekhaneId, tarih, ogunId),
    profilDeposu.kullaniciAlerjenleri(req.kullanici.id),
  ]);
  if (!menu) throw new UygulamaHatasi(404, 'Bu yemekhane, tarih ve öğün için menü bulunamadı.');

  const kisisel = menuServisi.alerjenUyarisiEkle(menu, alerjenler);
  res.json({ ...kisisel, ...menuServisi.fiyatSec(req.kullanici.rol, menu), kullanici_alerjenleri: alerjenler });
}

// GET /api/menuler/hafta?yemekhane=1[&baslangic=2026-11-19]   (haftalık menü)
async function haftalik(req, res) {
  const yemekhaneId = dogrula.pozitifTamsayi(req.query.yemekhane, 'Yemekhane');
  const baslangic = req.query.baslangic ? dogrula.tarih(req.query.baslangic, 'Başlangıç') : null;

  const satirlar = await menuDeposu.haftalik(yemekhaneId, req.kullanici.id, baslangic);
  const menuler = satirlar.map((s) => ({
    menu_id: s.menu_id,
    tarih: s.tarih,
    ogun_id: s.ogun_id,
    ogun: s.ogun,
    yemekler: s.yemekler,
    kapasite: s.kapasite,
    bos_yer: s.bos_yer,
    rezervasyon_son: s.rezervasyon_son,
    suresi_doldu: s.suresi_doldu === 1,
    rezervasyon_id: s.rezervasyon_id,
    rezervasyon_durum: s.rezervasyon_durum,   // null | aktif | kullanildi | iptal
    rezervasyon_porsiyon: s.rezervasyon_porsiyon,
    alerjen_uyarisi: s.alerjen_uyarisi === 1,
    ...menuServisi.fiyatSec(req.kullanici.rol, {
      ogrenci_fiyati: s.ogrenci_fiyati,
      personel_fiyati: s.personel_fiyati,
      ogrenci_yarim_fiyati: s.ogrenci_yarim_fiyati,
      personel_yarim_fiyati: s.personel_yarim_fiyati,
    }),
  }));
  res.json(menuler);
}

module.exports = { yemekhaneler, ogunler, gunluk, haftalik };
