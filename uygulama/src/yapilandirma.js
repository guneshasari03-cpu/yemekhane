// Tüm ayarlar ortam değişkenlerinden okunur (docker-compose.yml > x-uygulama-ortam).
// Kodun içinde sunucu adı ya da şifre yoktur.
module.exports = {
  port: Number(process.env.PORT || 8000),

  db: {
    yazmaHost: process.env.DB_YAZMA_HOST || 'mysql-primary',  // kaynak: yazma
    okumaHost: process.env.DB_OKUMA_HOST || 'mysql-replica',  // replika: okuma
    port: Number(process.env.DB_PORT || 3306),
    ad: process.env.DB_ADI || 'yemekhane',
    kullanici: process.env.DB_KULLANICI || 'yemekhane_app',
    sifre: process.env.DB_SIFRE || '',
  },

  // Oturum 30 dakika; her istekte süre yenilenir
  oturumSuresiSn: 30 * 60,
  oturumCerezAdi: 'oturum',

  // true ise her SQL sorgusunun hangi sunucuya gittiği günlüğe yazılır
  sqlGunlugu: process.env.SQL_GUNLUGU !== '0',
};
