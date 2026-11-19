// Yönetici paneli iş kuralları: menü girdisinin denetimi ve kayıt.
const yonetimDeposu = require('../veri/yonetimDeposu');
const { UygulamaHatasi } = require('../hatalar');
const { MYSQL_TEKRAR_KAYIT } = require('../ara/hataYakala');
const dogrula = require('../denetleyiciler/dogrula');

const MYSQL_YABANCI_ANAHTAR = 1452;   // olmayan yemek/yemekhane/öğün id'si

function fiyat(deger, ad) {
  const sayi = Number(deger);
  if (deger === '' || deger === null || !Number.isFinite(sayi) || sayi < 0) {
    throw new UygulamaHatasi(400, `${ad} 0 ya da daha büyük bir sayı olmalıdır.`);
  }
  return Math.round(sayi * 100) / 100;
}

function yemekListesi(deger) {
  if (!Array.isArray(deger) || deger.length === 0) {
    throw new UygulamaHatasi(400, 'Menüye en az bir yemek seçilmelidir.');
  }
  const idler = [...new Set(deger.map((id) => dogrula.pozitifTamsayi(id, 'Yemek')))];
  return idler;
}

function yabanciAnahtarHatasi(hata) {
  if (hata.errno === MYSQL_YABANCI_ANAHTAR) {
    return new UygulamaHatasi(400, 'Seçilen yemekhane, öğün ya da yemeklerden biri bulunamadı.');
  }
  return hata;
}

async function menuOlustur(govde = {}) {
  const veri = {
    yemekhane_id: dogrula.pozitifTamsayi(govde.yemekhane_id, 'Yemekhane'),
    tarih: dogrula.tarih(govde.tarih),
    ogun_id: dogrula.pozitifTamsayi(govde.ogun_id, 'Öğün'),
    ogrenci_fiyati: fiyat(govde.ogrenci_fiyati, 'Öğrenci fiyatı'),
    personel_fiyati: fiyat(govde.personel_fiyati, 'Personel fiyatı'),
    yemek_idler: yemekListesi(govde.yemek_idler),
  };
  try {
    const menuId = await yonetimDeposu.menuOlustur(veri);
    return { menu_id: menuId };
  } catch (hata) {
    if (hata.errno === MYSQL_TEKRAR_KAYIT) {
      throw new UygulamaHatasi(409, 'Bu yemekhane, tarih ve öğün için zaten bir menü var. Listeden düzenleyin.');
    }
    throw yabanciAnahtarHatasi(hata);
  }
}

async function menuGuncelle(menuId, govde = {}) {
  const veri = {
    ogrenci_fiyati: fiyat(govde.ogrenci_fiyati, 'Öğrenci fiyatı'),
    personel_fiyati: fiyat(govde.personel_fiyati, 'Personel fiyatı'),
    yemek_idler: yemekListesi(govde.yemek_idler),
  };
  let menu;
  try {
    menu = await yonetimDeposu.menuGuncelle(menuId, veri);
  } catch (hata) {
    throw yabanciAnahtarHatasi(hata);
  }
  if (!menu) throw new UygulamaHatasi(404, 'Menü bulunamadı.');
  return { menu_id: menuId };
}

module.exports = { menuOlustur, menuGuncelle };
