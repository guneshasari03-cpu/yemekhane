// Menü iş kuralları: satırları tek bir menü nesnesine çevirme, toplam kalori,
// kullanıcının rolüne göre fiyat ve Redis önbelleği.
const menuDeposu = require('../veri/menuDeposu');
const menuOnbellegi = require('../onbellek/menuOnbellegi');

function virgulluListe(metin) {
  return metin ? metin.split(', ') : [];
}

function sayiListesi(metin) {
  return metin ? metin.split(',').map(Number) : [];
}

// v_menu_detay satırlarından tek menü nesnesi üretir. Menü yoksa null.
function menuOlustur(satirlar) {
  if (satirlar.length === 0) return null;
  const ilk = satirlar[0];
  const yemekler = satirlar.map((s) => ({
    id: s.yemek_id,
    ad: s.yemek,
    kategori: s.kategori,
    kalori: s.kalori,
    vejetaryen: s.vejetaryen === 1,
    alerjenler: virgulluListe(s.alerjenler),
    alerjen_idler: sayiListesi(s.alerjen_idler),
  }));
  return {
    menu_id: ilk.menu_id,
    tarih: ilk.tarih,
    yemekhane_id: ilk.yemekhane_id,
    yemekhane: ilk.yemekhane,
    ogun_id: ilk.ogun_id,
    ogun: ilk.ogun,
    rezervasyon_son: ilk.rezervasyon_son,
    ogrenci_fiyati: ilk.ogrenci_fiyati,
    personel_fiyati: ilk.personel_fiyati,
    toplam_kalori: yemekler.reduce((toplam, y) => toplam + y.kalori, 0),
    tumu_vejetaryen: yemekler.every((y) => y.vejetaryen),
    yemekler,
  };
}

// Önce Redis'e bakılır; yoksa replikadan okunup Redis'e yazılır.
// Önbellekteki menü her iki fiyatı da içerir, rol fiyatı sonra seçilir.
async function menuGetir(yemekhaneId, tarih, ogunId) {
  const anahtar = menuOnbellegi.anahtar(yemekhaneId, tarih, ogunId);

  const onbellekte = await menuOnbellegi.oku(anahtar);
  if (onbellekte) {
    console.log(`[onbellek] Redis'ten geldi: ${anahtar}`);
    return onbellekte;
  }

  console.log(`[onbellek] Redis'te yok, veritabanından okunuyor: ${anahtar}`);
  const menu = menuOlustur(await menuDeposu.menuDetaySatirlari(yemekhaneId, tarih, ogunId));
  if (menu) await menuOnbellegi.yaz(anahtar, menu);
  return menu;
}

// Öğrenci öğrenci fiyatını, personel ve yönetici personel fiyatını öder.
// (sp_rezervasyon_yap da aynı kuralla ücret keser.)
function fiyatSec(rol, menu) {
  return rol === 'ogrenci'
    ? { fiyat: menu.ogrenci_fiyati, fiyat_turu: 'ogrenci' }
    : { fiyat: menu.personel_fiyati, fiyat_turu: 'personel' };
}

module.exports = { menuGetir, fiyatSec };
