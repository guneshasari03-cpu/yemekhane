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

// Haftalık menü: başlangıç gününden itibaren 7 gün (başlangıç verilmezse bugün).
// Boş yer v_menu_doluluk'tan, "son saat geçti mi" kararı veritabanının saatinden gelir.
// Kullanıcının o menüdeki rezervasyon durumu da aynı satırda döner.
async function haftalik(yemekhaneId, kullaniciId, baslangic) {
  return db.oku(
    `SELECT d.menu_id, d.tarih, d.ogun_id, d.ogun, d.kapasite, d.bos_yer,
            d.rezervasyon_son,
            (NOW() >= d.rezervasyon_son)          AS suresi_doldu,
            m.ogrenci_fiyati, m.personel_fiyati,
            (SELECT GROUP_CONCAT(y.ad ORDER BY k.sira, y.ad SEPARATOR ', ')
               FROM menu_yemekleri my
               JOIN yemekler y           ON y.id = my.yemek_id
               JOIN yemek_kategorileri k ON k.id = y.kategori_id
              WHERE my.menu_id = d.menu_id)       AS yemekler,
            r.id    AS rezervasyon_id,
            r.durum AS rezervasyon_durum
       FROM v_menu_doluluk d
       JOIN menuler m ON m.id = d.menu_id
       JOIN ogunler o ON o.id = d.ogun_id
       LEFT JOIN rezervasyonlar r
              ON r.menu_id = d.menu_id AND r.kullanici_id = ?
      WHERE d.yemekhane_id = ?
        AND d.tarih BETWEEN COALESCE(?, CURDATE())
                        AND COALESCE(?, CURDATE()) + INTERVAL 6 DAY
      ORDER BY d.tarih, o.sira`,
    [kullaniciId, yemekhaneId, baslangic, baslangic]
  );
}

module.exports = { yemekhaneler, ogunler, menuDetaySatirlari, haftalik };
