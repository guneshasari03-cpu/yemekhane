// Giriş, çıkış ve "ben kimim" uç noktaları.
const bcrypt = require('bcryptjs');
const ayar = require('../yapilandirma');
const kullaniciDeposu = require('../veri/kullaniciDeposu');
const oturumDeposu = require('../oturum/oturumDeposu');
const { UygulamaHatasi } = require('../hatalar');

const cerezAyari = {
  httpOnly: true,       // JavaScript çereze erişemez (XSS'e karşı)
  sameSite: 'strict',   // başka sitelerden gelen isteklerde gönderilmez
  path: '/',
};

// POST /api/oturum  { eposta, sifre }
async function girisYap(req, res) {
  const { eposta, sifre } = req.body ?? {};
  if (!eposta || !sifre) throw new UygulamaHatasi(400, 'E-posta ve şifre gerekli.');

  const kayit = await kullaniciDeposu.epostaIleBul(String(eposta).trim());
  const sifreDogru = kayit && (await bcrypt.compare(String(sifre), kayit.sifre_hash));
  // Hangi bilginin yanlış olduğu söylenmez (hesap varlığı sızdırılmaz)
  if (!sifreDogru) throw new UygulamaHatasi(401, 'E-posta ya da şifre hatalı.');
  if (!kayit.aktif) throw new UygulamaHatasi(403, 'Hesabınız pasif durumda.');

  const kullanici = {
    id: kayit.id,
    ad: kayit.ad,
    soyad: kayit.soyad,
    eposta: kayit.eposta,
    rol: kayit.rol,
  };
  const token = await oturumDeposu.olustur(kullanici);
  res.cookie(ayar.oturumCerezAdi, token, cerezAyari);
  res.json({ kullanici });
}

// DELETE /api/oturum
async function cikisYap(req, res) {
  await oturumDeposu.sil(req.token);
  res.clearCookie(ayar.oturumCerezAdi, cerezAyari);
  res.status(204).end();
}

// GET /api/ben  -> oturumdaki kullanıcı + güncel bakiye (kaynaktan)
async function ben(req, res) {
  const bakiye = await kullaniciDeposu.bakiyeGetir(req.kullanici.id);
  res.json({ kullanici: { ...req.kullanici, bakiye } });
}

module.exports = { girisYap, cikisYap, ben };
