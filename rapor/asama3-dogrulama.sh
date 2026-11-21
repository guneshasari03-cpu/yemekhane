#!/usr/bin/env bash
# =====================================================================
# Aşama 3 · Redis doğrulaması
# Menü önbelleği (isabet, süre, silinme) ve Redis oturumu (kayan süre,
# uygulama yeniden başlayınca da yaşaması, çıkışta silinmesi).
# Her komutu ve çıktısını rapor/asama3-cikti.txt dosyasına yazar.
#
# Depo kökünden (Git Bash):  bash rapor/asama3-dogrulama.sh
# =====================================================================
set -u
cd "$(dirname "$0")/.."

CIKTI=rapor/asama3-cikti.txt
: > "$CIKTI"

ADRES=http://localhost:8080/api
REDIS='docker compose exec -T redis redis-cli'
TARIH=$(date +%F)
ANAHTAR="menu:1:$TARIH:2"          # Merkez Yemekhane, bugün, öğle
OGRENCI=/tmp/yemekhane-ogrenci.jar  # curl çerez dosyaları (oturum token'ı burada)
YONETICI=/tmp/yemekhane-yonetici.jar
JSON='Content-Type: application/json'
rm -f "$OGRENCI" "$YONETICI"

baslik() {
    printf '\n==================================================================\n%s\n==================================================================\n' "$1" | tee -a "$CIKTI"
}

calistir() {
    printf '\n$ %s\n' "$1" | tee -a "$CIKTI"
    eval "$1" 2>&1 | tee -a "$CIKTI"
}

not() {
    printf '\n# %s\n' "$1" | tee -a "$CIKTI"
}

# Bir adımın başında çağrılır; gunluk() o andan sonraki uygulama günlüğünü gösterir
isaretle() { ISARET=$(date -u -d '-2 seconds' +%Y-%m-%dT%H:%M:%SZ); }
gunluk() {
    calistir "docker compose logs --no-color --since $ISARET uygulama | grep -av '\[sql'"
}

saglikli_bekle() {
    local servis=$1 durum=""
    for _ in $(seq 1 60); do
        durum=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$servis")" 2>/dev/null)
        [ "$durum" = "healthy" ] && return 0
        sleep 1
    done
    echo "UYARI: $servis healthy olmadı (durum: $durum)" | tee -a "$CIKTI"
}

echo "Aşama 3 doğrulaması · $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$CIKTI"
saglikli_bekle uygulama

# ---------------------------------------------------------------------
baslik "1. Menü önbelleği: ilk istek veritabanından, ikincisi Redis'ten"

not "Temiz başlangıç için anahtar silinir"
calistir "$REDIS DEL $ANAHTAR"

calistir "curl -s -c $OGRENCI -H '$JSON' -d '{\"eposta\":\"mehmet.yildiz@ogr.kampus.edu.tr\",\"sifre\":\"Yemek2026!\"}' $ADRES/oturum"
echo | tee -a "$CIKTI"

isaretle
calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$TARIH&ogun=2'"
calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$TARIH&ogun=2'"
not "Uygulama günlüğü: ilki 'Redis'te yok', ikincisi 'Redis'ten geldi'"
gunluk

baslik "2. Önbellekteki kayıt ve süresi (günün sonuna kadar)"
calistir "$REDIS --scan --pattern 'menu:*'"
calistir "$REDIS EXISTS $ANAHTAR"
not "TTL: şu andan bugün 23:59:59'a kadar kalan saniye"
calistir "$REDIS TTL $ANAHTAR"
calistir "$REDIS EXPIRETIME $ANAHTAR"
calistir "date -d @\$($REDIS EXPIRETIME $ANAHTAR) '+%Y-%m-%d %H:%M:%S'"
calistir "$REDIS GET $ANAHTAR | cut -c1-300"

# ---------------------------------------------------------------------
baslik "3. Yönetici menüyü değiştirince önbellek kaydı silinir"

MENU_ID=$(curl -s -b "$OGRENCI" "$ADRES/menu?yemekhane=1&tarih=$TARIH&ogun=2" | grep -o '"menu_id":[0-9]*' | head -1 | cut -d: -f2)
calistir "curl -s -c $YONETICI -H '$JSON' -d '{\"eposta\":\"leyla.arslan@kampus.edu.tr\",\"sifre\":\"Yemek2026!\"}' $ADRES/oturum"
echo | tee -a "$CIKTI"
calistir "curl -s -b $YONETICI $ADRES/yonetim/menuler/$MENU_ID"
echo | tee -a "$CIKTI"

MENU_JSON=$(curl -s -b "$YONETICI" "$ADRES/yonetim/menuler/$MENU_ID")
ESKI_OGR=$(echo "$MENU_JSON" | grep -o '"ogrenci_fiyati":[0-9.]*' | cut -d: -f2)
PERS=$(echo "$MENU_JSON" | grep -o '"personel_fiyati":[0-9.]*' | cut -d: -f2)
YEMEKLER=$(echo "$MENU_JSON" | grep -o '"yemek_idler":\[[0-9,]*\]' | cut -d: -f2)
YENI_OGR=$(awk "BEGIN{print $ESKI_OGR + 5}")

not "Öğrencinin gördüğü fiyat (önbellekten)"
calistir "curl -s -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$TARIH&ogun=2' | grep -o '\"fiyat\":[0-9.]*'"

isaretle
not "Yönetici öğrenci fiyatını $ESKI_OGR -> $YENI_OGR TL yapar"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $YONETICI -X PUT -H '$JSON' -d '{\"ogrenci_fiyati\":$YENI_OGR,\"personel_fiyati\":$PERS,\"yemek_idler\":$YEMEKLER}' $ADRES/yonetim/menuler/$MENU_ID"
not "Anahtar artık yok (0)"
calistir "$REDIS EXISTS $ANAHTAR"
sleep 2
not "Öğrenci yeni fiyatı görür; istek veritabanından gelir ve yeniden önbelleğe yazılır"
calistir "curl -s -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$TARIH&ogun=2' | grep -o '\"fiyat\":[0-9.]*'"
gunluk
calistir "$REDIS EXISTS $ANAHTAR"

not "Fiyat eski hâline döndürülür (yine silinir)"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $YONETICI -X PUT -H '$JSON' -d '{\"ogrenci_fiyati\":$ESKI_OGR,\"personel_fiyati\":$PERS,\"yemek_idler\":$YEMEKLER}' $ADRES/yonetim/menuler/$MENU_ID"
calistir "$REDIS EXISTS $ANAHTAR"

# ---------------------------------------------------------------------
baslik "4. Oturum Redis'te: oturum:{token}, 30 dakika, her istekte yenilenir"

TOKEN=$(awk '$6 == "oturum" { print $7 }' "$OGRENCI")
calistir "$REDIS --scan --pattern 'oturum:*'"
calistir "$REDIS GET oturum:$TOKEN"
calistir "$REDIS TTL oturum:$TOKEN"
not "5 saniye beklenir, süre azalır"
sleep 5
calistir "$REDIS TTL oturum:$TOKEN"
not "Oturumlu bir istek yapılır, süre yeniden 1800 saniyeye çekilir"
calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI $ADRES/ben"
calistir "$REDIS TTL oturum:$TOKEN"

# ---------------------------------------------------------------------
baslik "5. Uygulama container'ı yeniden başlasa da oturum düşmez"

calistir "curl -s -b $OGRENCI $ADRES/ben"
echo | tee -a "$CIKTI"
isaretle
calistir "docker compose restart uygulama"
saglikli_bekle uygulama
calistir "docker compose ps uygulama"
not "Aynı çerezle, yeniden giriş yapmadan:"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI $ADRES/ben"
gunluk

# ---------------------------------------------------------------------
baslik "6. Çıkış yapılınca oturum anahtarı silinir"

calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI -X DELETE $ADRES/oturum"
calistir "$REDIS EXISTS oturum:$TOKEN"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI $ADRES/ben"

curl -s -o /dev/null -b "$YONETICI" -X DELETE "$ADRES/oturum"
rm -f "$OGRENCI" "$YONETICI"
printf '\nBitti. Çıktı: %s\n' "$CIKTI"
