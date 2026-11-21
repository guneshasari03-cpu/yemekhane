// Haftalık menü ve rezervasyon ekranı.
// Fiyat, boş yer ve "süre doldu" bilgisi API'den hazır gelir; burada yalnızca gösterilir.
(async () => {
  const kutu = document.getElementById('bildirim');
  const alan = document.getElementById('hafta');
  const secim = document.getElementById('yemekhane');
  const adres = new URLSearchParams(location.search);

  let baslangic = adres.get('baslangic') || bugun();
  let menuler = [];

  try {
    await sayfaBaslat({ aktif: 'hafta' });
    const yemekhaneler = await api('/yemekhaneler');
    secim.innerHTML = yemekhaneler.map((y) => `<option value="${y.id}">${esc(y.ad)}</option>`).join('');
    secim.value = adres.get('yemekhane') || yemekhaneler[0].id;

    secim.addEventListener('change', yukle);
    document.getElementById('onceki').addEventListener('click', () => kaydir(-7));
    document.getElementById('sonraki').addEventListener('click', () => kaydir(7));
    alan.addEventListener('click', rezerveTiklandi);

    await yukle();
  } catch (hata) {
    bildirim(kutu, hata.message);
  }

  function kaydir(gun) {
    const d = tarihNesnesi(baslangic);
    d.setDate(d.getDate() + gun);
    baslangic = isoTarih(d);
    yukle();
  }

  async function yukle() {
    bildirimGizle(kutu);
    history.replaceState(null, '', `?yemekhane=${secim.value}&baslangic=${baslangic}`);

    const bitis = tarihNesnesi(baslangic);
    bitis.setDate(bitis.getDate() + 6);
    const kisa = { day: 'numeric', month: 'short' };
    document.getElementById('hafta-etiket').textContent =
      `${tarihYaz(baslangic, kisa)} – ${tarihYaz(isoTarih(bitis), kisa)}`;

    alan.innerHTML = '<p class="yukleniyor">Menüler yükleniyor…</p>';
    try {
      menuler = await api(`/menuler/hafta?yemekhane=${secim.value}&baslangic=${baslangic}`);
      ciz();
    } catch (hata) {
      alan.innerHTML = '';
      bildirim(kutu, hata.message);
    }
  }

  function ciz() {
    if (menuler.length === 0) {
      alan.innerHTML = '<p class="bos-durum">Bu tarih aralığında menü yok.</p>';
      return;
    }
    // Menüleri güne göre grupla
    const gunler = new Map();
    for (const m of menuler) {
      if (!gunler.has(m.tarih)) gunler.set(m.tarih, []);
      gunler.get(m.tarih).push(m);
    }
    const bugunTarih = bugun();
    alan.innerHTML = [...gunler].map(([tarih, liste]) => `
      <section class="gun">
        <h2 class="gun-baslik">${esc(tarihYaz(tarih, { day: 'numeric', month: 'long', weekday: 'long' }))}
          ${tarih === bugunTarih ? '<span class="etiket">Bugün</span>' : ''}</h2>
        <div class="ogun-izgara">${liste.map(kartCiz).join('')}</div>
      </section>`).join('');
  }

  function kartCiz(m) {
    return `
      <article class="ogun-kart${m.suresi_doldu ? ' gecmis' : ''}" id="menu-${m.menu_id}">
        <div class="ogun-kart-ust">
          <h3>${esc(m.ogun)}</h3>
          <span class="fiyat">${para(m.fiyat)}${m.yarim_fiyat !== null ? `<small>yarım ${para(m.yarim_fiyat)}</small>` : ''}</span>
        </div>
        ${m.alerjen_uyarisi ? '<span class="etiket etiket-uyari">⚠ Alerjenlerinizi içeren yemek var</span>' : ''}
        <p class="ogun-yemekler">${esc(m.yemekler)}</p>
        <dl class="ogun-bilgi">
          <div><dt>Boş yer</dt><dd>${sayiYaz(m.bos_yer)} / ${sayiYaz(m.kapasite)}</dd></div>
          <div><dt>Son saat</dt><dd>${esc(zamanYaz(m.rezervasyon_son))}</dd></div>
        </dl>
        <div class="ogun-eylem">${eylemCiz(m)}</div>
        <a class="detay" href="/menu.html?yemekhane=${secim.value}&tarih=${m.tarih}&ogun=${m.ogun_id}">Menü detayı ve alerjenler</a>
      </article>`;
  }

  function eylemCiz(m) {
    if (m.rezervasyon_durum === 'aktif') {
      const yarim = m.rezervasyon_porsiyon === 'yarim' ? ' (yarım porsiyon)' : '';
      return `<span class="durum durum-aktif">✓ Rezervasyonunuz var${yarim}</span>`;
    }
    if (m.rezervasyon_durum === 'kullanildi') {
      return '<span class="durum durum-kullanildi">Kullanıldı</span>';
    }
    if (m.suresi_doldu) {
      return '<button type="button" class="dugme" disabled>Süre doldu</button>';
    }
    if (m.bos_yer <= 0) {
      return '<button type="button" class="dugme" disabled>Kapasite dolu</button>';
    }
    // Yarım porsiyon olan öğünlerde iki seçenek, kahvaltıda tek düğme
    if (m.yarim_fiyat !== null) {
      return `
        <div class="porsiyon-dugmeler" role="group" aria-label="Porsiyon seçin">
          <button type="button" class="dugme" data-rezerve="${m.menu_id}" data-porsiyon="tam">Tam · ${para(m.fiyat)}</button>
          <button type="button" class="dugme dugme-ikincil" data-rezerve="${m.menu_id}" data-porsiyon="yarim">Yarım · ${para(m.yarim_fiyat)}</button>
        </div>`;
    }
    return `<button type="button" class="dugme" data-rezerve="${m.menu_id}" data-porsiyon="tam">Rezerve et</button>`;
  }

  async function rezerveTiklandi(olay) {
    const dugme = olay.target.closest('[data-rezerve]');
    if (!dugme) return;

    const menuId = Number(dugme.dataset.rezerve);
    const porsiyon = dugme.dataset.porsiyon;
    const kart = document.getElementById('menu-' + menuId);
    kart.querySelector('.satir-mesaj')?.remove();
    const eskiYazi = dugme.textContent;
    kart.querySelectorAll('[data-rezerve]').forEach((d) => { d.disabled = true; });
    dugme.textContent = 'İşleniyor…';

    try {
      // Yanıttaki bakiye yordamın KAYNAKTA hesapladığı değerdir
      const sonuc = await api('/rezervasyonlar', { yontem: 'POST', govde: { menu_id: menuId, porsiyon } });
      bakiyeGoster(sonuc.bakiye);

      // Liste replikadan yeniden çekilmez (gecikme olabilir); kart yerinde güncellenir
      const m = menuler.find((x) => x.menu_id === menuId);
      m.rezervasyon_durum = 'aktif';
      m.rezervasyon_porsiyon = sonuc.porsiyon;
      m.bos_yer -= 1;
      kart.outerHTML = kartCiz(m);
      document.getElementById('menu-' + menuId).querySelector('.ogun-eylem').insertAdjacentHTML('beforeend',
        `<p class="satir-mesaj basari">${para(sonuc.ucret)} düşüldü. Kalan bakiye: ${para(sonuc.bakiye)}</p>`);
    } catch (hata) {
      // Yordamın mesajı ("Bakiye yetersiz." vb.) olduğu gibi gösterilir
      kart.querySelectorAll('[data-rezerve]').forEach((d) => { d.disabled = false; });
      dugme.textContent = eskiYazi;
      kart.querySelector('.ogun-eylem').insertAdjacentHTML('beforeend', `<p class="satir-mesaj hata" role="alert">${esc(hata.message)}</p>`);
    }
  }
})();
