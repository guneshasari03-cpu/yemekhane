// Bakiye yükleme ve hareket geçmişi.
const db = require('./baglanti');

const HAREKET_ALANLARI = `
  h.id, h.tur, h.tutar, h.aciklama, h.olusturma,
  m.tarih AS menu_tarihi, o.ad AS ogun`;

const HAREKET_BIRLESTIRME = `
  FROM bakiye_hareketleri h
  LEFT JOIN rezervasyonlar r ON r.id = h.rezervasyon_id
  LEFT JOIN menuler m        ON m.id = r.menu_id
  LEFT JOIN ogunler o        ON o.id = m.ogun_id`;

// Dönen: { hareket_id, bakiye }. 10–1000 TL kuralını yordam denetler.
async function yukle(kullaniciId, tutar) {
  return db.yordam('sp_bakiye_yukle', [kullaniciId, tutar]);
}

// Son 50 hareket (replikadan: listeleme)
async function hareketler(kullaniciId) {
  return db.oku(
    `SELECT ${HAREKET_ALANLARI} ${HAREKET_BIRLESTIRME}
      WHERE h.kullanici_id = ?
      ORDER BY h.id DESC
      LIMIT 50`,
    [kullaniciId]
  );
}

// Az önce yazılan tek hareket (KAYNAKTAN: replikaya henüz geçmemiş olabilir)
async function hareketGetirKaynaktan(hareketId) {
  const satirlar = await db.birincildenOku(
    `SELECT ${HAREKET_ALANLARI} ${HAREKET_BIRLESTIRME} WHERE h.id = ?`,
    [hareketId]
  );
  return satirlar[0] || null;
}

module.exports = { yukle, hareketler, hareketGetirKaynaktan };
