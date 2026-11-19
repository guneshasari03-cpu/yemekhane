// =====================================================================
// Veri katmanının temeli: iki bağlantı havuzu
//   yazmaHavuzu  -> mysql-primary (kaynak)  : INSERT/UPDATE/CALL ve
//                                            "yazmadan hemen sonra" okumalar
//   okumaHavuzu  -> mysql-replica (replika) : listeleme ve raporlar
// Uygulamanın geri kalanı havuzları doğrudan görmez; bu dosyadaki
// oku / birincildenOku / yaz / yordam / islem fonksiyonlarını kullanır.
// =====================================================================
const mysql = require('mysql2/promise');
const ayar = require('../yapilandirma');

const ortak = {
  port: ayar.db.port,
  user: ayar.db.kullanici,
  password: ayar.db.sifre,
  database: ayar.db.ad,
  charset: 'utf8mb4',          // Türkçe karakterler bozulmasın
  timezone: '+03:00',          // MySQL ile aynı saat dilimi
  dateStrings: true,           // DATE / DATETIME metin olarak gelsin (saat kayması olmasın)
  decimalNumbers: true,        // DECIMAL alanlar sayı olarak gelsin (bakiye, fiyat)
  connectionLimit: 10,
  waitForConnections: true,
};

const yazmaHavuzu = mysql.createPool({ ...ortak, host: ayar.db.yazmaHost });
const okumaHavuzu = mysql.createPool({ ...ortak, host: ayar.db.okumaHost });

function gunluk(hedef, sql) {
  if (!ayar.sqlGunlugu) return;
  const tekSatir = sql.replace(/\s+/g, ' ').trim().slice(0, 110);
  console.log(`[sql:${hedef}] ${tekSatir}`);
}

// Replikadan okur. Listeleme ve raporlar için.
async function oku(sql, parametreler = []) {
  gunluk('okuma/replika', sql);
  const [satirlar] = await okumaHavuzu.query(sql, parametreler);
  return satirlar;
}

// Kaynaktan okur. Replikasyon gecikmesinin kabul edilemediği yerler için
// (ör. rezervasyondan hemen sonra gösterilen bakiye).
async function birincildenOku(sql, parametreler = []) {
  gunluk('okuma/kaynak', sql);
  const [satirlar] = await yazmaHavuzu.query(sql, parametreler);
  return satirlar;
}

// Kaynağa tek bir yazma komutu gönderir.
async function yaz(sql, parametreler = []) {
  gunluk('yazma/kaynak', sql);
  const [sonuc] = await yazmaHavuzu.query(sql, parametreler);
  return sonuc;
}

// Stored procedure çağırır (her zaman kaynakta) ve dönen tek satırı verir.
// Yordamlar kendi transaction'ını açtığı için burada BEGIN/COMMIT yoktur.
// Hata olursa (SQLSTATE 45000) hata olduğu gibi yukarı fırlatılır.
async function yordam(ad, parametreler = []) {
  const yerTutucular = parametreler.map(() => '?').join(', ');
  const sql = `CALL ${ad}(${yerTutucular})`;
  gunluk('yazma/kaynak', sql);
  const [sonuclar] = await yazmaHavuzu.query(sql, parametreler);
  // CALL sonucu: [ [ilk sonuç kümesinin satırları], OkPacket ]
  return sonuclar[0][0];
}

// Birden fazla yazma komutunu tek transaction içinde çalıştırır.
// Kullanım: await islem(async (b) => { await b.query(...); await b.query(...); })
async function islem(is) {
  const baglanti = await yazmaHavuzu.getConnection();
  const sorgu = async (sql, parametreler = []) => {
    gunluk('yazma/kaynak', sql);
    const [sonuc] = await baglanti.query(sql, parametreler);
    return sonuc;
  };
  try {
    await baglanti.beginTransaction();
    const sonuc = await is({ query: sorgu });
    await baglanti.commit();
    return sonuc;
  } catch (hata) {
    await baglanti.rollback();
    throw hata;
  } finally {
    baglanti.release();
  }
}

module.exports = { oku, birincildenOku, yaz, yordam, islem };
