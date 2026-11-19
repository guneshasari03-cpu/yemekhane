// Giriş ekranı
(async () => {
  const form = document.getElementById('giris-formu');
  const kutu = document.getElementById('bildirim');
  const dugme = document.getElementById('giris-dugme');

  // Zaten oturum varsa doğrudan menüye geç
  try {
    await api('/ben');
    location.replace('/menu.html');
    return;
  } catch {
    // oturum yok, formu göster
  }

  form.addEventListener('submit', async (olay) => {
    olay.preventDefault();
    bildirimGizle(kutu);

    const eposta = form.eposta.value.trim();
    const sifre = form.sifre.value;
    if (!eposta || !sifre) {
      bildirim(kutu, 'E-posta ve şifre gerekli.');
      return;
    }

    dugme.disabled = true;
    dugme.textContent = 'Giriş yapılıyor…';
    try {
      await api('/oturum', { yontem: 'POST', govde: { eposta, sifre } });
      location.href = '/menu.html';
    } catch (hata) {
      bildirim(kutu, hata.message);
      dugme.disabled = false;
      dugme.textContent = 'Giriş yap';
    }
  });
})();
