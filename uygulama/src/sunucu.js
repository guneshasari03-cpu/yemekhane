// =====================================================================
// Yemekhane Otomasyonu · Web API giriş noktası
// Katmanlar: rotalar.js -> denetleyiciler/ -> servisler/ -> veri/ -> MySQL
// =====================================================================
const express = require('express');
const ayar = require('./yapilandirma');
const rotalar = require('./rotalar');
const { hataYakala } = require('./ara/hataYakala');
const redis = require('./redisIstemci');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

// İstek günlüğü: yöntem, yol, durum kodu, süre
// (10 saniyede bir gelen healthcheck isteği günlüğü kalabalıklaştırmasın diye yazılmaz)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.originalUrl === '/api/') return next();
  const baslangic = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - baslangic} ms)`);
  });
  next();
});

app.use('/api', rotalar);

// Tanımsız API yolu
app.use('/api', (req, res) => res.status(404).json({ hata: 'İstenen adres bulunamadı.' }));

app.use(hataYakala);

const sunucu = app.listen(ayar.port, '0.0.0.0', () => {
  console.log(`Yemekhane API ${ayar.port} portunda çalışıyor`);
  console.log(`Yazma: ${ayar.db.yazmaHost}  Okuma: ${ayar.db.okumaHost}  Redis: ${ayar.redis.host}`);
});

// docker compose stop/restart SIGTERM gönderir: düzgün kapan (10 sn beklenmesin)
process.on('SIGTERM', () => {
  console.log('SIGTERM alındı, kapanıyor');
  sunucu.close(() => {
    redis.quit().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 3000).unref();
});
