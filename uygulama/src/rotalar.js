// =====================================================================
// Tüm API yolları tek yerde: yol -> (middleware) -> denetleyici
// Apache /api/ ile başlayan istekleri buraya iletir.
// =====================================================================
const express = require('express');
const { girisGerekli } = require('./ara/kimlik');
const oturum = require('./denetleyiciler/oturumDenetleyici');
const menu = require('./denetleyiciler/menuDenetleyici');

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

module.exports = r;
