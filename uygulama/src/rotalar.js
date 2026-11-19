// =====================================================================
// Tüm API yolları tek yerde: yol -> (middleware) -> denetleyici
// Apache /api/ ile başlayan istekleri buraya iletir.
// =====================================================================
const express = require('express');
const { girisGerekli } = require('./ara/kimlik');
const oturum = require('./denetleyiciler/oturumDenetleyici');
const menu = require('./denetleyiciler/menuDenetleyici');
const rezervasyon = require('./denetleyiciler/rezervasyonDenetleyici');
const bakiye = require('./denetleyiciler/bakiyeDenetleyici');

const r = express.Router();

// Sağlık kontrolü (healthcheck ve başlangıç sayfası kullanır)
r.get('/', (req, res) => res.json({ durum: 'çalışıyor' }));

// Oturum
r.post('/oturum', oturum.girisYap);
r.delete('/oturum', girisGerekli, oturum.cikisYap);
r.get('/ben', girisGerekli, oturum.ben);

// Tanımlar ve menü
r.get('/yemekhaneler', girisGerekli, menu.yemekhaneler);
r.get('/ogunler', girisGerekli, menu.ogunler);
r.get('/menu', girisGerekli, menu.gunluk);
r.get('/menuler/hafta', girisGerekli, menu.haftalik);

// Rezervasyon
r.get('/rezervasyonlar', girisGerekli, rezervasyon.listele);
r.post('/rezervasyonlar', girisGerekli, rezervasyon.olustur);
r.delete('/rezervasyonlar/:id', girisGerekli, rezervasyon.iptal);

// Bakiye
r.get('/bakiye', girisGerekli, bakiye.ozet);
r.post('/bakiye', girisGerekli, bakiye.yukle);

module.exports = r;
