// =====================================================================
// Tüm API yolları tek yerde: yol -> (middleware) -> denetleyici
// Apache /api/ ile başlayan istekleri buraya iletir.
// =====================================================================
const express = require('express');
const { girisGerekli, yoneticiGerekli } = require('./ara/kimlik');
const oturum = require('./denetleyiciler/oturumDenetleyici');
const menu = require('./denetleyiciler/menuDenetleyici');
const rezervasyon = require('./denetleyiciler/rezervasyonDenetleyici');
const bakiye = require('./denetleyiciler/bakiyeDenetleyici');
const degerlendirme = require('./denetleyiciler/degerlendirmeDenetleyici');
const yonetim = require('./denetleyiciler/yonetimDenetleyici');

const r = express.Router();
const yonetici = [girisGerekli, yoneticiGerekli];

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

// Değerlendirme
r.get('/degerlendirmeler', girisGerekli, degerlendirme.listele);
r.post('/degerlendirmeler', girisGerekli, degerlendirme.ekle);

// Yönetici paneli
r.get('/yonetim/menuler', ...yonetici, yonetim.menuRaporu);
r.get('/yonetim/menuler/:id', ...yonetici, yonetim.menuGetir);
r.post('/yonetim/menuler', ...yonetici, yonetim.menuOlustur);
r.put('/yonetim/menuler/:id', ...yonetici, yonetim.menuGuncelle);
r.get('/yonetim/yemekler', ...yonetici, yonetim.yemekler);

module.exports = r;
