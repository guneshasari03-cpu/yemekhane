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

// Bir menünün yemek satırları (v_menu_detay: her yemek bir satır).
// Aşama 4: yarım porsiyon oranı ve fiyatları ogunler.yarim_oran'dan hesaplanır
// (oran NULL ise o öğünde yarım porsiyon yoktur, fiyatlar da NULL gelir).
async function menuDetaySatirlari(yemekhaneId, tarih, ogunId) {
  return db.oku(
    `SELECT v.menu_id, v.tarih, v.yemekhane_id, v.yemekhane, v.ogun_id, v.ogun,
            v.rezervasyon_son, v.ogrenci_fiyati, v.personel_fiyati,
            o.yarim_oran,
            ROUND(v.ogrenci_fiyati * o.yarim_oran, 2)  AS ogrenci_yarim_fiyati,
            ROUND(v.personel_fiyati * o.yarim_oran, 2) AS personel_yarim_fiyati,
            v.yemek_id, v.yemek, v.kategori, v.kategori_sira, v.kalori, v.vejetaryen,
            v.alerjenler, v.alerjen_idler
       FROM v_menu_detay v
       JOIN ogunler o ON o.id = v.ogun_id
      WHERE v.yemekhane_id = ? AND v.tarih = ? AND v.ogun_id = ?
      ORDER BY v.kategori_sira, v.yemek`,
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
            o.yarim_oran,
            ROUND(m.ogrenci_fiyati * o.yarim_oran, 2)  AS ogrenci_yarim_fiyati,
            ROUND(m.personel_fiyati * o.yarim_oran, 2) AS personel_yarim_fiyati,
            EXISTS (SELECT 1
                      FROM menu_yemekleri my2
                      JOIN yemek_alerjenleri ya     ON ya.yemek_id = my2.yemek_id
                      JOIN kullanici_alerjenleri ka ON ka.alerjen_id = ya.alerjen_id
                     WHERE my2.menu_id = d.menu_id AND ka.kullanici_id = ?) AS alerjen_uyarisi,
            (SELECT GROUP_CONCAT(y.ad ORDER BY k.sira, y.ad SEPARATOR ', ')
               FROM menu_yemekleri my
               JOIN yemekler y           ON y.id = my.yemek_id
               JOIN yemek_kategorileri k ON k.id = y.kategori_id
              WHERE my.menu_id = d.menu_id)       AS yemekler,
            r.id       AS rezervasyon_id,
            r.durum    AS rezervasyon_durum,
            r.porsiyon AS rezervasyon_porsiyon
       FROM v_menu_doluluk d
       JOIN menuler m ON m.id = d.menu_id
       JOIN ogunler o ON o.id = d.ogun_id
       LEFT JOIN rezervasyonlar r
              ON r.menu_id = d.menu_id AND r.kullanici_id = ?
      WHERE d.yemekhane_id = ?
        AND d.tarih BETWEEN COALESCE(?, CURDATE())
                        AND COALESCE(?, CURDATE()) + INTERVAL 6 DAY
      ORDER BY d.tarih, o.sira`,
    [kullaniciId, kullaniciId, yemekhaneId, baslangic, baslangic]
  );
}

module.exports = { yemekhaneler, ogunler, menuDetaySatirlari, haftalik };
