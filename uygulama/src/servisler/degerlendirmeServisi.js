// Değerlendirme iş kuralları. Şema yalnızca "1–5 arası, kişi başına tek oy"
// kuralını tutar; "yalnızca kullanılmış menü değerlendirilir" kuralı buradadır.
const degerlendirmeDeposu = require('../veri/degerlendirmeDeposu');
const { UygulamaHatasi } = require('../hatalar');
const { MYSQL_TEKRAR_KAYIT } = require('../ara/hataYakala');

const YORUM_EN_FAZLA = 500;

async function ekle(kullaniciId, menuId, puanGirdi, yorumGirdi) {
  const puan = Number(puanGirdi);
  // CHECK kısıtına takılmadan önce uygulamada denetlenir (ham CHECK hatası kullanıcıya gösterilmez)
  if (!Number.isInteger(puan) || puan < 1 || puan > 5) {
    throw new UygulamaHatasi(400, 'Puan 1 ile 5 arasında olmalıdır.');
  }

  const yorum = typeof yorumGirdi === 'string' && yorumGirdi.trim() !== '' ? yorumGirdi.trim() : null;
  if (yorum && yorum.length > YORUM_EN_FAZLA) {
    throw new UygulamaHatasi(400, `Yorum en fazla ${YORUM_EN_FAZLA} karakter olabilir.`);
  }

  if (!(await degerlendirmeDeposu.menuyuKullandiMi(kullaniciId, menuId))) {
    throw new UygulamaHatasi(403, 'Yalnızca kullandığınız menüleri değerlendirebilirsiniz.');
  }

  try {
    await degerlendirmeDeposu.ekle(kullaniciId, menuId, puan, yorum);
  } catch (hata) {
    if (hata.errno === MYSQL_TEKRAR_KAYIT) {
      throw new UygulamaHatasi(409, 'Bu menüyü zaten değerlendirdiniz.');
    }
    throw hata;
  }
  return { menu_id: menuId, puan, yorum };
}

module.exports = { ekle };
