// Kullanıcı tablosuna erişim. Bu dosya dışında kullanicilar tablosuna SQL yazılmaz.
const db = require('./baglanti');

// Giriş için: e-postaya göre kullanıcıyı (şifre özetiyle birlikte) getirir.
async function epostaIleBul(eposta) {
  const satirlar = await db.oku(
    `SELECT id, ad, soyad, eposta, sifre_hash, rol, aktif
       FROM kullanicilar
      WHERE eposta = ?`,
    [eposta]
  );
  return satirlar[0] || null;
}

// Güncel bakiye KAYNAKTAN okunur: yazmadan hemen sonra replika henüz
// güncellenmemiş olabilir (replikasyon gecikmesi).
async function bakiyeGetir(kullaniciId) {
  const satirlar = await db.birincildenOku(
    'SELECT bakiye FROM kullanicilar WHERE id = ?',
    [kullaniciId]
  );
  return satirlar[0] ? satirlar[0].bakiye : null;
}

module.exports = { epostaIleBul, bakiyeGetir };
