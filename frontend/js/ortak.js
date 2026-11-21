// =====================================================================
// Tüm sayfaların ortak yardımcıları: üst çubuk, gezinme, biçimlendirme.
// Burada iş kuralı yoktur; yalnızca gösterim yapılır.
// =====================================================================

const SAYFALAR = [
  { anahtar: 'menu',           adres: '/menu.html',             ad: 'Günün Menüsü' },
  { anahtar: 'hafta',          adres: '/hafta.html',            ad: 'Haftalık Menü' },
  { anahtar: 'rezervasyonlar', adres: '/rezervasyonlarim.html', ad: 'Rezervasyonlarım' },
  { anahtar: 'bakiye',         adres: '/bakiye.html',           ad: 'Bakiye' },
  { anahtar: 'degerlendirme',  adres: '/degerlendirme.html',    ad: 'Değerlendirme' },
  { anahtar: 'profil',         adres: '/profil.html',           ad: 'Profil' },
  { anahtar: 'yonetim',        adres: '/yonetim.html',          ad: 'Yönetim', yonetici: true },
];

// HTML'e yazılacak her metin buradan geçer (XSS'e karşı)
function esc(metin) {
  return String(metin ?? '').replace(/[&<>"']/g, (k) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]
  ));
}

function para(tutar) {
  return Number(tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}

function sayiYaz(sayi) {
  return Number(sayi).toLocaleString('tr-TR');
}

// 'YYYY-AA-GG' -> Date (yerel saatle, gün kaymadan)
function tarihNesnesi(metin) {
  const [y, a, g] = metin.slice(0, 10).split('-').map(Number);
  return new Date(y, a - 1, g);
}

// '2026-11-18' -> '18 Kasım 2026 Çarşamba'
function tarihYaz(metin, secenek = { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }) {
  return tarihNesnesi(metin).toLocaleDateString('tr-TR', secenek);
}

// '2026-11-18 10:00:00' -> '18 Kas 10:00'
function zamanYaz(metin) {
  const tarih = tarihYaz(metin, { day: 'numeric', month: 'short' });
  return tarih + ' ' + metin.slice(11, 16);
}

// Date -> 'YYYY-AA-GG'
function isoTarih(d) {
  const a = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${a}-${g}`;
}

function bugun() {
  return isoTarih(new Date());
}

// Bildirim kutusunu gösterir. tur: 'hata' | 'basari' | 'bilgi' | 'uyari'
function bildirim(kutu, mesaj, tur = 'hata') {
  kutu.className = 'bildirim bildirim-' + tur;
  kutu.setAttribute('role', tur === 'hata' ? 'alert' : 'status');
  kutu.textContent = mesaj;
  kutu.hidden = false;
}

function bildirimGizle(kutu) {
  kutu.hidden = true;
  kutu.textContent = '';
}

// Üst çubuktaki bakiyeyi günceller (rezervasyon, iptal, yükleme sonrası)
function bakiyeGoster(bakiye) {
  const yer = document.getElementById('ust-bakiye');
  if (yer) yer.textContent = para(bakiye);
}

// Her korumalı sayfanın başında çağrılır: oturumu kontrol eder,
// üst çubuğu çizer ve oturumdaki kullanıcıyı döndürür.
async function sayfaBaslat({ aktif, yoneticiGerekli = false } = {}) {
  const { kullanici } = await api('/ben');

  if (yoneticiGerekli && kullanici.rol !== 'yonetici') {
    location.href = '/menu.html';
    throw new Error('Yönetici yetkisi gerekiyor.');
  }

  const baglantilar = SAYFALAR
    .filter((s) => !s.yonetici || kullanici.rol === 'yonetici')
    .map((s) => `<li><a href="${s.adres}"${s.anahtar === aktif ? ' aria-current="page"' : ''}>${esc(s.ad)}</a></li>`)
    .join('');

  const ust = document.getElementById('ust');
  ust.className = 'ust';
  ust.innerHTML = `
    <div class="kapsayici ust-satir">
      <a class="marka" href="/menu.html">Yemek<span>hane</span></a>
      <div class="kullanici-kutu">
        <div>
          <a class="kullanici-ad" href="/profil.html">${esc(kullanici.ad)} ${esc(kullanici.soyad)}</a>
          <span class="bakiye-rozet" id="ust-bakiye">${para(kullanici.bakiye)}</span>
        </div>
        <button type="button" class="cikis-dugme" id="cikis">Çıkış</button>
      </div>
    </div>
    <nav class="gezinme" aria-label="Ana menü"><ul>${baglantilar}</ul></nav>`;

  document.getElementById('cikis').addEventListener('click', async () => {
    try { await api('/oturum', { yontem: 'DELETE' }); } finally { location.href = '/index.html'; }
  });

  return kullanici;
}
