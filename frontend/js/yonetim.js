// Yönetici paneli: menü raporu (doluluk + puan), menü oluşturma ve düzenleme.
(async () => {
  const kutu = document.getElementById('bildirim');
  const filtre = document.getElementById('filtre');
  const rapor = document.getElementById('rapor');
  const form = document.getElementById('menu-formu');
  const sekmeler = document.getElementById('sekmeler');

  let duzenlenenId = null;   // null: yeni menü, sayı: düzenlenen menü

  try {
    await sayfaBaslat({ aktif: 'yonetim', yoneticiGerekli: true });
    const [yemekhaneler, ogunler, yemekler] = await Promise.all([
      api('/yemekhaneler'), api('/ogunler'), api('/yonetim/yemekler'),
    ]);

    const secenekler = yemekhaneler.map((y) => `<option value="${y.id}">${esc(y.ad)}</option>`).join('');
    filtre.yemekhane.insertAdjacentHTML('beforeend', secenekler);
    form.yemekhane_id.innerHTML = secenekler;
    form.ogun_id.innerHTML = ogunler.map((o) => `<option value="${o.id}">${esc(o.ad)}</option>`).join('');
    yemekSecimiCiz(yemekler);

    // Varsayılan rapor aralığı: 7 gün önce – 6 gün sonra
    const once = new Date(); once.setDate(once.getDate() - 7);
    const sonra = new Date(); sonra.setDate(sonra.getDate() + 6);
    filtre.baslangic.value = isoTarih(once);
    filtre.bitis.value = isoTarih(sonra);

    filtre.addEventListener('change', raporYukle);
    rapor.addEventListener('click', duzenleTiklandi);
    form.addEventListener('submit', kaydet);
    document.getElementById('vazgec').addEventListener('click', () => { formuSifirla(); bolumGoster('rapor'); });
    sekmeler.addEventListener('click', (olay) => {
      const d = olay.target.closest('button');
      if (!d) return;
      if (d.dataset.bolum === 'form' && duzenlenenId === null) formuSifirla();
      bolumGoster(d.dataset.bolum);
    });

    formuSifirla();
    await raporYukle();
  } catch (hata) {
    bildirim(kutu, hata.message);
  }

  function bolumGoster(bolum) {
    document.getElementById('bolum-rapor').hidden = bolum !== 'rapor';
    document.getElementById('bolum-form').hidden = bolum !== 'form';
    sekmeler.querySelectorAll('button').forEach((d) => d.setAttribute('aria-pressed', String(d.dataset.bolum === bolum)));
  }

  // ---------- Rapor ----------
  async function raporYukle() {
    const p = new URLSearchParams({ baslangic: filtre.baslangic.value, bitis: filtre.bitis.value });
    if (filtre.yemekhane.value) p.set('yemekhane', filtre.yemekhane.value);
    rapor.innerHTML = '<tr><td class="yukleniyor">Yükleniyor…</td></tr>';
    try {
      const satirlar = await api('/yonetim/menuler?' + p);
      rapor.innerHTML = satirlar.length
        ? satirlar.map(satirCiz).join('')
        : '<tr><td class="soluk">Bu aralıkta menü yok.</td></tr>';
    } catch (hata) {
      rapor.innerHTML = '';
      bildirim(kutu, hata.message);
    }
  }

  function satirCiz(s) {
    const yuzde = Number(s.doluluk_yuzde);
    const puan = s.ortalama_puan === null
      ? '<span class="soluk">—</span>'
      : `<span><span class="puan-goster">★</span> ${Number(s.ortalama_puan).toLocaleString('tr-TR')} <span class="soluk">(${s.oy_sayisi} oy)</span></span>`;
    return `
      <tr>
        <td data-etiket="Tarih">${esc(tarihYaz(s.tarih, { day: 'numeric', month: 'short', weekday: 'short' }))}</td>
        <td data-etiket="Öğün">${esc(s.ogun)}</td>
        <td data-etiket="Yemekhane">${esc(s.yemekhane)}</td>
        <td data-etiket="Doluluk">
          <div class="doluluk">
            <span class="sayi">${sayiYaz(s.rezerve)} / ${sayiYaz(s.kapasite)} · %${yuzde.toLocaleString('tr-TR')}</span>
            <div class="doluluk-cubuk"><span class="${yuzde >= 80 ? 'yuksek' : ''}" style="width:${Math.min(yuzde, 100)}%"></span></div>
          </div>
        </td>
        <td data-etiket="Puan">${puan}</td>
        <td data-etiket="Fiyat" class="sayi">${para(s.ogrenci_fiyati)} / ${para(s.personel_fiyati)}</td>
        <td class="eylem"><button type="button" class="dugme dugme-ikincil" data-duzenle="${s.menu_id}">Düzenle</button></td>
      </tr>`;
  }

  // ---------- Form ----------
  function yemekSecimiCiz(yemekler) {
    const kategoriler = new Map();
    for (const y of yemekler) {
      if (!kategoriler.has(y.kategori)) kategoriler.set(y.kategori, []);
      kategoriler.get(y.kategori).push(y);
    }
    document.getElementById('yemek-secimi').innerHTML = [...kategoriler].map(([kategori, liste]) => `
      <fieldset class="yemek-secim">
        <legend>${esc(kategori)}</legend>
        <div class="yemek-secim-liste">
          ${liste.map((y) => `
            <label class="yemek-secenek">
              <input type="checkbox" name="yemek" value="${y.id}">
              <span class="ad">${esc(y.ad)}${y.vejetaryen ? ' <span class="etiket etiket-veg">V</span>' : ''}</span>
              <span class="kcal">${sayiYaz(y.kalori)} kcal</span>
            </label>`).join('')}
        </div>
      </fieldset>`).join('');
  }

  function formuSifirla() {
    duzenlenenId = null;
    form.reset();
    form.tarih.value = bugun();
    for (const ad of ['yemekhane_id', 'tarih', 'ogun_id']) form[ad].disabled = false;
    document.getElementById('form-baslik').textContent = 'Yeni menü';
    document.getElementById('kaydet').textContent = 'Menüyü oluştur';
    document.getElementById('vazgec').hidden = true;
    sekmeler.querySelector('[data-bolum="form"]').textContent = 'Yeni menü';
  }

  async function duzenleTiklandi(olay) {
    const dugme = olay.target.closest('[data-duzenle]');
    if (!dugme) return;
    bildirimGizle(kutu);
    try {
      const menu = await api('/yonetim/menuler/' + dugme.dataset.duzenle);
      duzenlenenId = menu.menu_id;
      form.yemekhane_id.value = menu.yemekhane_id;
      form.tarih.value = menu.tarih;
      form.ogun_id.value = menu.ogun_id;
      // Yemekhane, tarih ve öğün menünün kimliğidir; düzenlemede değiştirilmez
      for (const ad of ['yemekhane_id', 'tarih', 'ogun_id']) form[ad].disabled = true;
      form.ogrenci_fiyati.value = menu.ogrenci_fiyati;
      form.personel_fiyati.value = menu.personel_fiyati;
      form.querySelectorAll('input[name="yemek"]').forEach((k) => {
        k.checked = menu.yemek_idler.includes(Number(k.value));
      });
      document.getElementById('form-baslik').textContent = `Menüyü düzenle · ${tarihYaz(menu.tarih, { day: 'numeric', month: 'long' })}`;
      document.getElementById('kaydet').textContent = 'Değişiklikleri kaydet';
      document.getElementById('vazgec').hidden = false;
      sekmeler.querySelector('[data-bolum="form"]').textContent = 'Düzenle';
      bolumGoster('form');
      window.scrollTo({ top: 0 });
    } catch (hata) {
      bildirim(kutu, hata.message);
    }
  }

  async function kaydet(olay) {
    olay.preventDefault();
    bildirimGizle(kutu);
    const govde = {
      ogrenci_fiyati: form.ogrenci_fiyati.value,
      personel_fiyati: form.personel_fiyati.value,
      yemek_idler: [...form.querySelectorAll('input[name="yemek"]:checked')].map((k) => Number(k.value)),
    };
    const dugme = document.getElementById('kaydet');
    dugme.disabled = true;
    try {
      if (duzenlenenId === null) {
        Object.assign(govde, {
          yemekhane_id: Number(form.yemekhane_id.value),
          tarih: form.tarih.value,
          ogun_id: Number(form.ogun_id.value),
        });
        await api('/yonetim/menuler', { yontem: 'POST', govde });
        bildirim(kutu, 'Menü oluşturuldu.', 'basari');
      } else {
        await api('/yonetim/menuler/' + duzenlenenId, { yontem: 'PUT', govde });
        bildirim(kutu, 'Menü güncellendi.', 'basari');
      }
      formuSifirla();
      bolumGoster('rapor');
      await raporYukle();
    } catch (hata) {
      bildirim(kutu, hata.message);
    } finally {
      dugme.disabled = false;
      window.scrollTo({ top: 0 });
    }
  }
})();
