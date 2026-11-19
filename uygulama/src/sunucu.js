// =====================================================================
// Yemekhane Otomasyonu · Web API giriş noktası
// Katmanlar: rotalar.js -> denetleyiciler/ -> servisler/ -> veri/ -> MySQL
// =====================================================================
const express = require('express');
const ayar = require('./yapilandirma');
const rotalar = require('./rotalar');
const { hataYakala } = require('./ara/hataYakala');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

// İstek günlüğü: yöntem, yol, durum kodu, süre
app.use((req, res, next) => {
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

app.listen(ayar.port, '0.0.0.0', () => {
  console.log(`Yemekhane API ${ayar.port} portunda çalışıyor`);
  console.log(`Yazma: ${ayar.db.yazmaHost}  Okuma: ${ayar.db.okumaHost}`);
});
