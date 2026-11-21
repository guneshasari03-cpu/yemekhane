// Aşama 4 · Profil: alerjen tanımları ve kullanıcının seçtiği alerjenler.
const db = require('./baglanti');

// Tüm alerjenler (replika)
async function alerjenler() {
  return db.oku('SELECT id, ad FROM alerjenler ORDER BY ad');
}

// Kullanıcının alerjenleri. Menü ekranı replikadan okur; profil ekranı az önce
// kaydedilmiş olabileceği için kaynaktan okur (kaynaktan = true).
async function kullaniciAlerjenleri(kullaniciId, kaynaktan = false) {
  const sql =
    `SELECT a.id, a.ad
       FROM kullanici_alerjenleri ka
       JOIN alerjenler a ON a.id = ka.alerjen_id
      WHERE ka.kullanici_id = ?
      ORDER BY a.ad`;
  return kaynaktan ? db.birincildenOku(sql, [kullaniciId]) : db.oku(sql, [kullaniciId]);
}

// Kullanıcının alerjen listesini tek transaction'da değiştirir
async function alerjenleriKaydet(kullaniciId, alerjenIdleri) {
  return db.islem(async (b) => {
    await b.query('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
    if (alerjenIdleri.length > 0) {
      await b.query(
        'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES ?',
        [alerjenIdleri.map((id) => [kullaniciId, id])]
      );
    }
  });
}

module.exports = { alerjenler, kullaniciAlerjenleri, alerjenleriKaydet };
