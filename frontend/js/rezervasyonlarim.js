// Rezervasyonlarım ekranı: listeleme, duruma göre süzme, iptal.
(async () => {
  const kutu = document.getElementById('bildirim');
  const alan = document.getElementById('liste');
  const sekmeler = document.getElementById('sekmeler');

  const DURUM_ADI = { aktif: 'Aktif', kullanildi: 'Kullanıldı', iptal: 'İptal' };
  let rezervasyonlar = [];
  let suzgec = '';

  try {
    await sayfaBaslat({ aktif: 'rezervasyonlar' });
    alan.innerHTML = '<p class="yukleniyor">Yükleniyor…</p>';
    rezervasyonlar = await api('/rezervasyonlar');
    ciz();
  } catch (hata) {
    alan.innerHTML = '';
    bildirim(kutu, hata.message);
  }

  sekmeler.addEventListener('click', (olay) => {
    const dugme = olay.target.closest('button');
    if (!dugme) return;
    suzgec = dugme.dataset.durum;
    sekmeler.querySelectorAll('button').forEach((d) => d.setAttribute('aria-pressed', String(d === dugme)));
    ciz();
  });

  alan.addEventListener('click', iptalTiklandi);

  function ciz() {
    const gosterilecek = rezervasyonlar.filter((r) => !suzgec || r.durum === suzgec);
    if (gosterilecek.length === 0) {
      alan.innerHTML = '<p class="bos-durum">Bu listede rezervasyon yok. ' +
        '<a href="/hafta.html">Haftalık menüden rezervasyon yapın →</a></p>';
      return;
    }
    alan.innerHTML = gosterilecek.map(kartCiz).join('');
  }

  function kartCiz(r) {
    let ayrinti;
    if (r.durum === 'aktif') ayrinti = `İptal için son: ${esc(zamanYaz(r.rezervasyon_son))}`;
    else if (r.durum === 'kullanildi') ayrinti = r.kullanma_zamani ? `Kullanım: ${esc(zamanYaz(r.kullanma_zamani))}` : 'Kullanıldı';
    else ayrinti = r.iptal_zamani ? `İptal: ${esc(zamanYaz(r.iptal_zamani))} · ücret iade edildi` : 'İptal edildi';

    const eylemler = [
      r.iptal_edilebilir
        ? `<button type="button" class="dugme dugme-ikincil" data-iptal="${r.id}">İptal et</button>` : '',
      r.degerlendirilebilir
        ? `<a class="dugme" href="/degerlendirme.html?menu=${r.menu_id}">Değerlendir</a>` : '',
    ].join('');

    return `
      <article class="rez-kart" id="rez-${r.id}">
        <div class="rez-ust">
          <div>
            <strong>${esc(r.ogun)} · ${esc(tarihYaz(r.tarih, { day: 'numeric', month: 'long', weekday: 'long' }))}</strong>
            <span class="soluk kucuk">${esc(r.yemekhane)} · ${para(r.ucret)}</span>
          </div>
          <span class="durum durum-${r.durum}">${DURUM_ADI[r.durum]}</span>
        </div>
        <p class="rez-alt">${ayrinti}</p>
        <div class="rez-eylem">${eylemler}</div>
      </article>`;
  }

  // İki adımlı iptal: ilk tıklamada onay istenir, 4 saniye içinde ikinci tıklama iptal eder
  async function iptalTiklandi(olay) {
    const dugme = olay.target.closest('[data-iptal]');
    if (!dugme) return;
    const id = Number(dugme.dataset.iptal);
    const kart = document.getElementById('rez-' + id);
    kart.querySelector('.satir-mesaj')?.remove();

    if (dugme.dataset.onay !== 'evet') {
      dugme.dataset.onay = 'evet';
      dugme.className = 'dugme dugme-tehlike';
      dugme.textContent = 'İptali onayla';
      setTimeout(() => {
        if (dugme.isConnected && !dugme.disabled) {
          dugme.dataset.onay = '';
          dugme.className = 'dugme dugme-ikincil';
          dugme.textContent = 'İptal et';
        }
      }, 4000);
      return;
    }

    dugme.disabled = true;
    dugme.textContent = 'İptal ediliyor…';
    try {
      const sonuc = await api('/rezervasyonlar/' + id, { yontem: 'DELETE' });
      bakiyeGoster(sonuc.bakiye);
      const r = rezervasyonlar.find((x) => x.id === id);
      r.durum = 'iptal';
      r.iptal_edilebilir = false;
      r.iptal_zamani = null;
      kart.outerHTML = kartCiz(r);
      document.getElementById('rez-' + id).insertAdjacentHTML('beforeend',
        `<p class="satir-mesaj basari">Rezervasyon iptal edildi, ${para(sonuc.iade)} iade edildi.</p>`);
    } catch (hata) {
      dugme.disabled = false;
      dugme.dataset.onay = '';
      dugme.className = 'dugme dugme-ikincil';
      dugme.textContent = 'İptal et';
      kart.insertAdjacentHTML('beforeend', `<p class="satir-mesaj hata" role="alert">${esc(hata.message)}</p>`);
    }
  }
})();
