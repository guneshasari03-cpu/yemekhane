// =====================================================================
// API istemcisi: tüm fetch çağrıları buradan geçer.
// Sunucunun döndürdüğü { hata: "..." } mesajı (ör. yordamdan gelen
// "Bakiye yetersiz.") olduğu gibi Error mesajı yapılır.
// =====================================================================
async function api(yol, { yontem = 'GET', govde } = {}) {
  const basliklar = { Accept: 'application/json' };
  if (govde !== undefined) basliklar['Content-Type'] = 'application/json';

  let yanit;
  try {
    yanit = await fetch('/api' + yol, {
      method: yontem,
      headers: basliklar,
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
  }

  let veri = null;
  if (yanit.status !== 204) {
    try { veri = await yanit.json(); } catch { veri = null; }
  }

  // Oturum düştüyse giriş sayfasına dön (giriş sayfasının kendisi hariç)
  if (yanit.status === 401 && document.body.dataset.sayfa !== 'giris') {
    location.href = '/index.html';
    throw new Error('Oturum açmanız gerekiyor.');
  }

  if (!yanit.ok) {
    if (veri && veri.hata) throw new Error(veri.hata);
    if (yanit.status === 502 || yanit.status === 503) throw new Error('Uygulama servisine ulaşılamıyor.');
    throw new Error('Beklenmeyen bir hata oluştu (HTTP ' + yanit.status + ').');
  }
  return veri;
}
