// =====================================================================
// Tek Redis bağlantısı. Menü önbelleği ve oturum deposu bunu paylaşır.
// Adres ortam değişkenlerinden gelir (REDIS_HOST, REDIS_PORT).
// =====================================================================
const Redis = require('ioredis');
const ayar = require('./yapilandirma');

const istemci = new Redis({
  host: ayar.redis.host,
  port: ayar.redis.port,
  maxRetriesPerRequest: 2,   // Redis yoksa istek sonsuza dek beklemesin
});

istemci.on('connect', () => console.log(`[redis] ${ayar.redis.host}:${ayar.redis.port} bağlantısı kuruldu`));
istemci.on('error', (hata) => console.error('[redis] hata:', hata.message));

module.exports = istemci;
