// Günün menüsü ekranı
(async () => {
  const kutu = document.getElementById('bildirim');
  const alan = document.getElementById('menu');
  const form = document.getElementById('secim');

  try {
    await sayfaBaslat({ aktif: 'menu' });
    const [yemekhaneler, ogunler] = await Promise.all([api('/yemekhaneler'), api('/ogunler')]);

    // Seçimler adres çubuğundan gelebilir (haftalık menüden bağlantı): ?yemekhane=1&tarih=...&ogun=2
    const adres = new URLSearchParams(location.search);

    form.yemekhane.innerHTML = yemekhaneler
      .map((y) => `<option value="${y.id}">${esc(y.ad)}</option>`).join('');
    form.yemekhane.value = adres.get('yemekhane') || yemekhaneler[0].id;
    form.tarih.value = adres.get('tarih') || bugun();

    const seciliOgun = adres.get('ogun') || '2';
    document.getElementById('ogunler').innerHTML = ogunler.map((o) => `
      <label><input type="radio" name="ogun" value="${o.id}"${String(o.id) === seciliOgun ? ' checked' : ''}>
        <span>${esc(o.ad)}</span></label>`).join('');

    form.addEventListener('change', yukle);
    await yukle();
  } catch (hata) {
    bildirim(kutu, hata.message);
  }

  async function yukle() {
    bildirimGizle(kutu);
    const yemekhane = form.yemekhane.value;
    const tarih = form.tarih.value;
    const ogun = form.querySelector('input[name="ogun"]:checked')?.value;
    if (!tarih || !ogun) return;

    // Seçimi adres çubuğuna yaz: sayfa yenilenince aynı menü açılsın
    history.replaceState(null, '', `?yemekhane=${yemekhane}&tarih=${tarih}&ogun=${ogun}`);

    alan.innerHTML = '<p class="yukleniyor">Menü yükleniyor…</p>';
    try {
      const menu = await api(`/menu?yemekhane=${yemekhane}&tarih=${tarih}&ogun=${ogun}`);
      alan.innerHTML = menuCiz(menu);
    } catch (hata) {
      alan.innerHTML = '';
      bildirim(kutu, hata.message, 'bilgi');
    }
  }

  function menuCiz(m) {
    const yemekler = m.yemekler.map((y) => {
      // Kullanıcının alerjenleri kırmızı, diğer alerjenler turuncu etiketle gösterilir
      const etiketler = [
        y.vejetaryen ? '<span class="etiket etiket-veg">Vejetaryen</span>' : '',
        ...y.alerjenler.map((a) => {
          const sizin = y.uyari_alerjenler.includes(a);
          return `<span class="etiket ${sizin ? 'etiket-uyari' : 'etiket-alerjen'}">${esc(a)}</span>`;
        }),
      ].join('');
      const uyari = y.uyari_alerjenler.length
        ? `<p class="yemek-uyari" role="note">⚠ Alerjeniniz: ${esc(y.uyari_alerjenler.join(', '))}</p>`
        : '';
      return `
        <li class="yemek${y.uyari_alerjenler.length ? ' uyarili' : ''}">
          <span class="yemek-kategori">${esc(y.kategori)}</span>
          <span class="yemek-ad">${esc(y.ad)}</span>
          <span class="yemek-kalori">${sayiYaz(y.kalori)} kcal</span>
          <div class="etiketler">${etiketler}</div>
          ${uyari}
        </li>`;
    }).join('');

    const fiyatAciklama = m.fiyat_turu === 'ogrenci' ? 'öğrenci fiyatı' : 'personel fiyatı';
    const ozet = m.tumu_vejetaryen
      ? '<div class="menu-ozet"><span class="etiket etiket-veg">Bu menü tamamen vejetaryen</span></div>'
      : '';

    let alerjenBilgi;
    if (m.uyarili_yemek_sayisi > 0) {
      alerjenBilgi = `<p class="bildirim bildirim-hata uyari-bant" role="alert">⚠ Bu menüde alerjenlerinizi içeren
        ${m.uyarili_yemek_sayisi} yemek var. İşaretli yemeklere dikkat edin.</p>`;
    } else if (m.kullanici_alerjenleri.length === 0) {
      alerjenBilgi = `<p class="bildirim bildirim-bilgi uyari-bant">Alerjenlerinizi <a href="/profil.html">Profil</a>
        sayfasından seçerseniz bunları içeren yemekler burada işaretlenir.</p>`;
    } else {
      alerjenBilgi = `<p class="bildirim bildirim-basari uyari-bant">Bu menüde alerjenlerinizi
        (${esc(m.kullanici_alerjenleri.map((a) => a.ad).join(', '))}) içeren yemek yok.</p>`;
    }
    const yarim = m.yarim_fiyat !== null
      ? `<small>yarım porsiyon ${para(m.yarim_fiyat)}</small>`
      : '<small>yarım porsiyon yok</small>';

    return `
      ${alerjenBilgi}
      <article class="fis">
        <header class="fis-ust">
          <div>
            <p class="fis-ogun">${esc(m.ogun)}</p>
            <p class="fis-tarih">${esc(tarihYaz(m.tarih))} · ${esc(m.yemekhane)}</p>
          </div>
          <p class="fis-fiyat">${para(m.fiyat)}<small>${fiyatAciklama}</small>${yarim}</p>
        </header>
        ${ozet}
        <ul class="yemek-listesi">${yemekler}</ul>
        <footer class="fis-alt">
          <span>Toplam kalori</span>
          <strong>${sayiYaz(m.toplam_kalori)} kcal</strong>
        </footer>
      </article>
      <p class="menu-alt-baglanti">
        <a href="/hafta.html?yemekhane=${m.yemekhane_id}">Bu yemekhanenin haftalık menüsü ve rezervasyon →</a>
      </p>`;
  }
})();
