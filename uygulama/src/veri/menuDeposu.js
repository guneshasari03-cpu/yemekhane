// Menü, yemekhane ve öğün sorguları. Okumalar replikaya gider.
const db = require('./baglanti');

async function yemekhaneler() {
  return db.oku('SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id');
}

async function ogunler() {
  return db.oku(
    `SELECT id, ad, sira, TIME_FORMAT(son_saat, '%H:%i') AS son_saat
       FROM ogunler ORDER BY sira`
  );
}

// Bir menünün yemek satırları (v_menu_detay: her yemek bir satır)
async function menuDetaySatirlari(yemekhaneId, tarih, ogunId) {
  return db.oku(
    `SELECT menu_id, tarih, yemekhane_id, yemekhane, ogun_id, ogun,
            rezervasyon_son, ogrenci_fiyati, personel_fiyati,
            yemek_id, yemek, kategori, kategori_sira, kalori, vejetaryen,
            alerjenler, alerjen_idler
       FROM v_menu_detay
      WHERE yemekhane_id = ? AND tarih = ? AND ogun_id = ?
      ORDER BY kategori_sira, yemek`,
    [yemekhaneId, tarih, ogunId]
  );
}

module.exports = { yemekhaneler, ogunler, menuDetaySatirlari };
