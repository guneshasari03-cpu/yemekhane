// Değerlendirme sorguları.
const db = require('./baglanti');

// Kullanıcı bu menüyü gerçekten kullandı mı? Yazmadan hemen önceki kontrol
// olduğu için KAYNAKTAN okunur (turnike geçişi replikaya henüz geçmemiş olabilir).
async function menuyuKullandiMi(kullaniciId, menuId) {
  const satirlar = await db.birincildenOku(
    `SELECT 1 FROM rezervasyonlar
      WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi'`,
    [kullaniciId, menuId]
  );
  return satirlar.length > 0;
}

async function ekle(kullaniciId, menuId, puan, yorum) {
  return db.yaz(
    `INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
     VALUES (?, ?, ?, ?)`,
    [kullaniciId, menuId, puan, yorum]
  );
}

const MENU_BILGISI = `
  m.tarih, o.ad AS ogun, yh.ad AS yemekhane,
  (SELECT GROUP_CONCAT(y.ad ORDER BY k.sira, y.ad SEPARATOR ', ')
     FROM menu_yemekleri my
     JOIN yemekler y           ON y.id = my.yemek_id
     JOIN yemek_kategorileri k ON k.id = y.kategori_id
    WHERE my.menu_id = m.id) AS yemekler`;

// Kullanılmış ama henüz puanlanmamış menüler (replika)
async function bekleyenler(kullaniciId) {
  return db.oku(
    `SELECT r.menu_id, ${MENU_BILGISI}
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id  = r.menu_id
       JOIN ogunler o       ON o.id  = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
       LEFT JOIN degerlendirmeler d
              ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
      WHERE r.kullanici_id = ? AND r.durum = 'kullanildi' AND d.id IS NULL
      ORDER BY m.tarih DESC, o.sira DESC`,
    [kullaniciId]
  );
}

// Kullanıcının verdiği puanlar (replika)
async function verilenler(kullaniciId) {
  return db.oku(
    `SELECT d.id, d.menu_id, d.puan, d.yorum, d.olusturma, ${MENU_BILGISI}
       FROM degerlendirmeler d
       JOIN menuler m       ON m.id  = d.menu_id
       JOIN ogunler o       ON o.id  = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
      WHERE d.kullanici_id = ?
      ORDER BY d.olusturma DESC`,
    [kullaniciId]
  );
}

module.exports = { menuyuKullandiMi, ekle, bekleyenler, verilenler };
