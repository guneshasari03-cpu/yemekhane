// =====================================================================
// Menü önbelleği (Redis)
//   Anahtar : menu:{yemekhane_id}:{tarih}:{ogun_id}
//   Süre    : menünün tarihinin sonuna kadar (EXAT ile o günün 23:59:59'u)
//   Silinme : yönetici o menüyü değiştirdiğinde
// Önbellek yalnızca hızlandırıcıdır: Redis'e ulaşılamazsa menü yine
// veritabanından okunur, kullanıcı hata görmez.
// =====================================================================
const istemci = require('../redisIstemci');

function anahtar(yemekhaneId, tarih, ogunId) {
  return `menu:${yemekhaneId}:${tarih}:${ogunId}`;
}

// '2026-11-20' -> o günün 23:59:59'u (İstanbul, UTC+3) Unix saniyesi
function gunSonu(tarih) {
  return Math.floor(new Date(`${tarih}T23:59:59+03:00`).getTime() / 1000);
}

async function oku(menuAnahtari) {
  try {
    const deger = await istemci.get(menuAnahtari);
    return deger ? JSON.parse(deger) : null;
  } catch (hata) {
    console.error(`[onbellek] Redis okunamadı (${hata.message}), veritabanına gidiliyor`);
    return null;
  }
}

async function yaz(menuAnahtari, menu) {
  const bitis = gunSonu(menu.tarih);
  if (bitis <= Date.now() / 1000) return;   // günü geçmiş menü önbelleğe alınmaz
  try {
    await istemci.set(menuAnahtari, JSON.stringify(menu), 'EXAT', bitis);
  } catch (hata) {
    console.error(`[onbellek] Redis'e yazılamadı (${hata.message})`);
  }
}

// Menü değişince çağrılır. Replikasyon gecikmesine karşı anahtar 1 saniye sonra
// bir kez daha silinir: silme ile replikanın güncellenmesi arasındaki kısa
// aralıkta gelen bir istek, replikadaki ESKİ menüyü önbelleğe yazmış olabilir.
async function sil(menuAnahtari) {
  try {
    await istemci.del(menuAnahtari);
    console.log(`[onbellek] silindi: ${menuAnahtari} (menü değişti)`);
    setTimeout(() => istemci.del(menuAnahtari).catch(() => {}), 1000).unref();
  } catch (hata) {
    console.error(`[onbellek] ${menuAnahtari} silinemedi (${hata.message})`);
  }
}

module.exports = { anahtar, oku, yaz, sil };
