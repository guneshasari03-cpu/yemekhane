// Profil ekranı (Aşama 4): hesap bilgileri ve alerjen seçimi.
(async () => {
  const kutu = document.getElementById('bildirim');
  const form = document.getElementById('alerjen-formu');
  const liste = document.getElementById('alerjenler');
  const dugme = document.getElementById('kaydet');

  const ROL_ADI = { ogrenci: 'Öğrenci', personel: 'Personel', yonetici: 'Yönetici' };

  try {
    await sayfaBaslat({ aktif: 'profil' });
    const [profil, tumAlerjenler] = await Promise.all([api('/profil'), api('/alerjenler')]);

    const k = profil.kullanici;
    document.getElementById('hesap').innerHTML = `
      <div><dt>Ad soyad</dt><dd>${esc(k.ad)} ${esc(k.soyad)}</dd></div>
      <div><dt>E-posta</dt><dd>${esc(k.eposta)}</dd></div>
      <div><dt>Rol</dt><dd>${esc(ROL_ADI[k.rol] || k.rol)}</dd></div>
      <div><dt>Bakiye</dt><dd>${para(k.bakiye)}</dd></div>`;

    const secili = new Set(profil.alerjenler.map((a) => a.id));
    liste.innerHTML = tumAlerjenler.map((a) => `
      <label class="yemek-secenek">
        <input type="checkbox" name="alerjen" value="${a.id}"${secili.has(a.id) ? ' checked' : ''}>
        <span class="ad">${esc(a.ad)}</span>
      </label>`).join('');
  } catch (hata) {
    bildirim(kutu, hata.message);
  }

  form.addEventListener('submit', async (olay) => {
    olay.preventDefault();
    bildirimGizle(kutu);
    const alerjenIdler = [...form.querySelectorAll('input[name="alerjen"]:checked')].map((k) => Number(k.value));
    dugme.disabled = true;
    try {
      const sonuc = await api('/profil/alerjenler', { yontem: 'PUT', govde: { alerjen_idler: alerjenIdler } });
      const adlar = sonuc.alerjenler.map((a) => a.ad).join(', ');
      bildirim(kutu, adlar
        ? `Kaydedildi. Menüde şu alerjenleri içeren yemekler işaretlenecek: ${adlar}.`
        : 'Kaydedildi. Alerjen seçmediniz; menüde uyarı gösterilmeyecek.', 'basari');
    } catch (hata) {
      bildirim(kutu, hata.message);
    } finally {
      dugme.disabled = false;
      window.scrollTo({ top: 0 });
    }
  });
})();
