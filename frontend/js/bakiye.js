// Bakiye ekranı: güncel bakiye, hareket geçmişi, yükleme.
// Tutar sınırı (10–1000 TL) yordamda denetlenir; hata mesajı olduğu gibi gösterilir.
(async () => {
  const kutu = document.getElementById('bildirim');
  const liste = document.getElementById('hareketler');
  const form = document.getElementById('yukle-formu');
  const dugme = document.getElementById('yukle-dugme');

  const TUR_ADI = { yukleme: 'Bakiye yükleme', rezervasyon: 'Rezervasyon', iade: 'İade' };

  try {
    await sayfaBaslat({ aktif: 'bakiye' });
    const ozet = await api('/bakiye');
    bakiyeYaz(ozet.bakiye);
    liste.innerHTML = ozet.hareketler.length
      ? ozet.hareketler.map((h) => hareketCiz(h)).join('')
      : '<li class="soluk">Henüz hareket yok.</li>';
  } catch (hata) {
    bildirim(kutu, hata.message);
  }

  document.getElementById('hizli').addEventListener('click', (olay) => {
    const b = olay.target.closest('[data-tutar]');
    if (b) { form.tutar.value = b.dataset.tutar; form.tutar.focus(); }
  });

  form.addEventListener('submit', async (olay) => {
    olay.preventDefault();
    bildirimGizle(kutu);
    const tutar = form.tutar.value.replace(',', '.');
    if (tutar === '') { bildirim(kutu, 'Bir tutar girin.'); return; }

    dugme.disabled = true;
    try {
      const sonuc = await api('/bakiye', { yontem: 'POST', govde: { tutar: Number(tutar) } });
      bakiyeYaz(sonuc.bakiye);
      // Yeni hareket API'de kaynaktan okunup gönderildi; listenin başına eklenir
      liste.querySelector('.soluk')?.remove();
      liste.insertAdjacentHTML('afterbegin', hareketCiz(sonuc.hareket, true));
      bildirim(kutu, `${para(sonuc.hareket.tutar)} yüklendi.`, 'basari');
      form.reset();
    } catch (hata) {
      bildirim(kutu, hata.message);
    } finally {
      dugme.disabled = false;
    }
  });

  function bakiyeYaz(bakiye) {
    document.getElementById('bakiye').textContent = para(bakiye);
    bakiyeGoster(bakiye);
  }

  function hareketCiz(h, yeni = false) {
    const menu = h.menu_tarihi
      ? ` · ${esc(tarihYaz(h.menu_tarihi, { day: 'numeric', month: 'short' }))} ${esc(h.ogun)}` : '';
    const isaret = h.tutar > 0 ? '+' : '−';
    return `
      <li class="hareket${yeni ? ' yeni' : ''}">
        <div>
          <span class="hareket-ad">${esc(h.aciklama || TUR_ADI[h.tur] || h.tur)}${menu}</span>
          <span class="hareket-zaman">${esc(zamanYaz(h.olusturma))}</span>
        </div>
        <span class="hareket-tutar ${h.tutar > 0 ? 'arti' : 'eksi'}">${isaret}${para(Math.abs(h.tutar))}</span>
      </li>`;
  }
})();
