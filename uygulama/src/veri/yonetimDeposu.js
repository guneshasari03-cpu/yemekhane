// Yönetici paneli sorguları: raporlar replikadan, menü yazmaları kaynakta transaction ile.
const db = require('./baglanti');

// Menü bazında doluluk ve ortalama puan (rapor -> replika)
async function menuRaporu(yemekhaneId, baslangic, bitis) {
  return db.oku(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.kapasite, d.rezerve, d.bos_yer, d.doluluk_yuzde,
            m.ogrenci_fiyati, m.personel_fiyati,
            p.oy_sayisi, p.ortalama_puan
       FROM v_menu_doluluk d
       JOIN menuler m    ON m.id = d.menu_id
       JOIN ogunler o    ON o.id = d.ogun_id
       JOIN v_menu_puan p ON p.menu_id = d.menu_id
      WHERE (? IS NULL OR d.yemekhane_id = ?)
        AND d.tarih BETWEEN ? AND ?
      ORDER BY d.tarih DESC, o.sira, d.yemekhane_id`,
    [yemekhaneId, yemekhaneId, baslangic, bitis]
  );
}

// Menü formu için tüm yemekler (replika)
async function yemekler() {
  return db.oku(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen,
            k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira
       FROM yemekler y
       JOIN yemek_kategorileri k ON k.id = y.kategori_id
      ORDER BY k.sira, y.ad`
  );
}

// Düzenleme formu için tek menü. Az önce kaydedilmiş olabileceği için KAYNAKTAN.
async function menuGetir(menuId) {
  const menuler = await db.birincildenOku(
    `SELECT id AS menu_id, yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati
       FROM menuler WHERE id = ?`,
    [menuId]
  );
  if (menuler.length === 0) return null;
  const yemekSatirlari = await db.birincildenOku(
    'SELECT yemek_id FROM menu_yemekleri WHERE menu_id = ? ORDER BY yemek_id',
    [menuId]
  );
  return { ...menuler[0], yemek_idler: yemekSatirlari.map((s) => s.yemek_id) };
}

// Yeni menü: menuler + menu_yemekleri tek transaction'da
async function menuOlustur({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  return db.islem(async (b) => {
    const sonuc = await b.query(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`,
      [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]
    );
    const menuId = sonuc.insertId;
    await b.query(
      'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
      [yemek_idler.map((yemekId) => [menuId, yemekId])]
    );
    return menuId;
  });
}

// Menü güncelleme: fiyatlar + yemek listesi. Dönen: güncellenen menünün anahtar alanları
// (Aşama 3'te önbellek anahtarını silmek için kullanılacak) ya da bulunamadıysa null.
async function menuGuncelle(menuId, { ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  return db.islem(async (b) => {
    const menu = await b.query(
      'SELECT yemekhane_id, tarih, ogun_id FROM menuler WHERE id = ? FOR UPDATE',
      [menuId]
    );
    if (menu.length === 0) return null;

    await b.query(
      'UPDATE menuler SET ogrenci_fiyati = ?, personel_fiyati = ? WHERE id = ?',
      [ogrenci_fiyati, personel_fiyati, menuId]
    );
    await b.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
    await b.query(
      'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
      [yemek_idler.map((yemekId) => [menuId, yemekId])]
    );
    return menu[0];
  });
}

module.exports = { menuRaporu, yemekler, menuGetir, menuOlustur, menuGuncelle };
