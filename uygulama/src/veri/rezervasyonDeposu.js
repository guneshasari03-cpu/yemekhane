// Rezervasyon işlemleri. Yazmalar yordamlarla kaynakta, listeleme replikada.
const db = require('./baglanti');

// Dönen: { rezervasyon_id, porsiyon, ucret, bakiye }  (bakiye kaynaktaki güncel değerdir)
// Aşama 4: porsiyon 'tam' | 'yarim'. Geçerlilik ve yarım ücret yordamda hesaplanır.
async function rezervasyonYap(kullaniciId, menuId, porsiyon) {
  return db.yordam('sp_rezervasyon_yap', [kullaniciId, menuId, porsiyon]);
}

// Dönen: { rezervasyon_id, iade, bakiye }
async function iptalEt(kullaniciId, rezervasyonId) {
  return db.yordam('sp_rezervasyon_iptal', [kullaniciId, rezervasyonId]);
}

// Kullanıcının tüm rezervasyonları (yeniden eskiye).
// iptal_edilebilir ve degerlendirilebilir kararları veritabanında verilir.
async function kullanicininRezervasyonlari(kullaniciId) {
  return db.oku(
    `SELECT r.id, r.menu_id, r.durum, r.porsiyon, r.ucret, r.olusturma,
            r.kullanma_zamani, r.iptal_zamani,
            m.tarih, m.yemekhane_id, yh.ad AS yemekhane,
            m.ogun_id, o.ad AS ogun,
            TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
            (r.durum = 'aktif' AND NOW() < TIMESTAMP(m.tarih, o.son_saat)) AS iptal_edilebilir,
            (r.durum = 'kullanildi' AND d.id IS NULL)                      AS degerlendirilebilir
       FROM rezervasyonlar r
       JOIN menuler m       ON m.id  = r.menu_id
       JOIN ogunler o       ON o.id  = m.ogun_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
       LEFT JOIN degerlendirmeler d
              ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
      WHERE r.kullanici_id = ?
      ORDER BY m.tarih DESC, o.sira DESC`,
    [kullaniciId]
  );
}

module.exports = { rezervasyonYap, iptalEt, kullanicininRezervasyonlari };
