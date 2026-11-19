// Değerlendirme ekranı: kullanılmış menülere puan ve yorum.
(async () => {
  const kutu = document.getElementById('bildirim');
  const bekleyenAlan = document.getElementById('bekleyenler');
  const verilenAlan = document.getElementById('verilenler');
  const hedefMenu = Number(new URLSearchParams(location.search).get('menu')) || null;

  let bekleyenler = [];
  let verilenler = [];

  try {
    await sayfaBaslat({ aktif: 'degerlendirme' });
    ({ bekleyenler, verilenler } = await api('/degerlendirmeler'));
    ciz();
    // Rezervasyonlarım'dan "Değerlendir" ile gelindiyse o karta git
    const hedef = hedefMenu && document.getElementById('deg-' + hedefMenu);
    if (hedef) {
      hedef.classList.add('vurgulu');
      hedef.scrollIntoView({ block: 'center' });
    }
  } catch (hata) {
    bekleyenAlan.innerHTML = '';
    bildirim(kutu, hata.message);
  }

  bekleyenAlan.addEventListener('submit', gonder);

  function menuBasligi(m) {
    return `
      <strong class="blok">${esc(m.ogun)} · ${esc(tarihYaz(m.tarih, { day: 'numeric', month: 'long', weekday: 'long' }))}</strong>
      <span class="soluk kucuk blok">${esc(m.yemekhane)}</span>
      <p class="rez-alt">${esc(m.yemekler)}</p>`;
  }

  function yildizGoster(puan) {
    return `<span class="puan-goster" aria-label="${puan} / 5">${'★'.repeat(puan)}<span class="bos">${'★'.repeat(5 - puan)}</span></span>`;
  }

  function ciz() {
    bekleyenAlan.innerHTML = bekleyenler.length
      ? bekleyenler.map(bekleyenCiz).join('')
      : '<p class="bos-durum">Değerlendirme bekleyen menü yok. Turnikeden geçtiğiniz menüler burada görünür.</p>';
    verilenAlan.innerHTML = verilenler.length
      ? verilenler.map(verilenCiz).join('')
      : '<p class="bos-durum">Henüz puan vermediniz.</p>';
  }

  function bekleyenCiz(m) {
    const ad = 'puan-' + m.menu_id;
    const yildizlar = [5, 4, 3, 2, 1].map((p) => `
      <input type="radio" id="${ad}-${p}" name="puan" value="${p}">
      <label for="${ad}-${p}" title="${p} puan">★</label>`).join('');
    return `
      <article class="rez-kart deg-kart" id="deg-${m.menu_id}">
        ${menuBasligi(m)}
        <form class="deg-form" data-menu="${m.menu_id}" novalidate>
          <fieldset class="yildizlar"><legend class="soluk kucuk" style="position:absolute;left:-9999px">Puan</legend>${yildizlar}</fieldset>
          <div>
            <label for="yorum-${m.menu_id}">Yorum <span class="soluk">(isteğe bağlı)</span></label>
            <textarea id="yorum-${m.menu_id}" name="yorum" rows="3"></textarea>
          </div>
          <button type="submit" class="dugme">Gönder</button>
        </form>
      </article>`;
  }

  function verilenCiz(d) {
    return `
      <article class="rez-kart">
        <div class="rez-ust">
          <div>${menuBasligi(d)}</div>
          ${yildizGoster(d.puan)}
        </div>
        ${d.yorum ? `<p class="yorum">“${esc(d.yorum)}”</p>` : ''}
      </article>`;
  }

  async function gonder(olay) {
    olay.preventDefault();
    const form = olay.target;
    const menuId = Number(form.dataset.menu);
    const kart = document.getElementById('deg-' + menuId);
    kart.querySelector('.satir-mesaj')?.remove();

    const secili = form.querySelector('input[name="puan"]:checked');
    const dugme = form.querySelector('button');
    dugme.disabled = true;
    try {
      const sonuc = await api('/degerlendirmeler', {
        yontem: 'POST',
        govde: { menu_id: menuId, puan: secili ? Number(secili.value) : null, yorum: form.yorum.value },
      });
      // Kart "bekleyenler"den "verilenler"e taşınır
      const menu = bekleyenler.find((m) => m.menu_id === menuId);
      bekleyenler = bekleyenler.filter((m) => m.menu_id !== menuId);
      verilenler.unshift({ ...menu, puan: sonuc.puan, yorum: sonuc.yorum });
      ciz();
      bildirim(kutu, 'Değerlendirmeniz kaydedildi. Teşekkürler!', 'basari');
      kutu.scrollIntoView({ block: 'center' });
    } catch (hata) {
      dugme.disabled = false;
      dugme.insertAdjacentHTML('afterend', `<p class="satir-mesaj hata" role="alert">${esc(hata.message)}</p>`);
    }
  }
})();
