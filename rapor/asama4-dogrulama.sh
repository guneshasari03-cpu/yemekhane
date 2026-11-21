#!/usr/bin/env bash
# =====================================================================
# Aşama 4 · Değişiklik talebinin çalışan sisteme uygulanması ve doğrulanması
#   1) Önceki durum (eski şema, eski yapıdaki Redis menü kaydı)
#   2) Migration kaynakta (iki kez: tekrar çalıştırılabilir olduğunu göstermek için)
#   3) Değişikliğin replikaya geçtiğinin kanıtı (SHOW CREATE TABLE replikadan)
#   4) Yeni uygulamanın derlenip başlatılması
#   5) Redis'te eski yapıdaki menü kayıtlarının temizlenmesi
#   6) Yarım porsiyon ve alerjen uyarısının denenmesi
# Her komutu ve çıktısını rapor/asama4-cikti.txt dosyasına yazar.
#
# Depo kökünden (Git Bash):  bash rapor/asama4-dogrulama.sh
# =====================================================================
set -u
cd "$(dirname "$0")/.."

CIKTI=rapor/asama4-cikti.txt
: > "$CIKTI"

ADRES=http://localhost:8080/api
REDIS='docker compose exec -T redis redis-cli'
KAYNAK_ROOT='docker compose exec -T mysql-primary mysql --default-character-set=utf8mb4 -uroot -pyemekhane_kok yemekhane'
KAYNAK='docker compose exec -T mysql-primary mysql --default-character-set=utf8mb4 -t -uyemekhane_app -pUyg_2026 yemekhane'
REPLIKA='docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -t -uyemekhane_app -pUyg_2026 yemekhane'
REPLIKA_ROOT='docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -uroot -pyemekhane_kok'
YARIN=$(date -d tomorrow +%F)
OGLE_ANAHTAR="menu:1:$YARIN:2"
OGRENCI=/tmp/yemekhane-ogrenci.jar
JSON='Content-Type: application/json'
rm -f "$OGRENCI"

baslik() {
    printf '\n==================================================================\n%s\n==================================================================\n' "$1" | tee -a "$CIKTI"
}
calistir() {
    printf '\n$ %s\n' "$1" | tee -a "$CIKTI"
    eval "$1" 2>&1 | grep -av "Using a password on the command line" | tee -a "$CIKTI"
}
not() { printf '\n# %s\n' "$1" | tee -a "$CIKTI"; }
saglikli_bekle() {
    local servis=$1 durum=""
    for _ in $(seq 1 90); do
        durum=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$servis")" 2>/dev/null)
        [ "$durum" = "healthy" ] && return 0
        sleep 2
    done
    echo "UYARI: $servis healthy olmadı (durum: $durum)" | tee -a "$CIKTI"
}
giris() {
    curl -s -c "$OGRENCI" -H "$JSON" -d '{"eposta":"mehmet.yildiz@ogr.kampus.edu.tr","sifre":"Yemek2026!"}' "$ADRES/oturum" > /dev/null
}

echo "Aşama 4 doğrulaması · $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$CIKTI"

# ---------------------------------------------------------------------
baslik "1. Önceki durum"

not "Replikada rezervasyonlar tablosunun sütunları (porsiyon yok)"
calistir "$REPLIKA -e \"SHOW COLUMNS FROM rezervasyonlar\""
not "Veri özeti (kaynak): rezervasyon sayısı ve bakiye = hareket toplamı kuralı"
calistir "$KAYNAK -e \"SELECT COUNT(*) AS rezervasyon, (SELECT SUM(bakiye) FROM kullanicilar) AS toplam_bakiye, (SELECT SUM(tutar) FROM bakiye_hareketleri) AS hareket_toplami FROM rezervasyonlar\""

not "Eski uygulama yarının öğle menüsünü önbelleğe alır (eski yapıdaki kayıt)"
giris
calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=2'"
calistir "$REDIS --scan --pattern 'menu:*'"
calistir "$REDIS GET $OGLE_ANAHTAR | cut -c1-220"

# ---------------------------------------------------------------------
baslik "2. Migration kaynakta (04_degisiklik.sql)"

calistir "$KAYNAK_ROOT < db/init/04_degisiklik.sql && echo 'Migration tamam'"
not "Tekrar çalıştırılabilir: ikinci çalıştırma hata vermez, veriyi değiştirmez"
calistir "$KAYNAK_ROOT < db/init/04_degisiklik.sql && echo 'İkinci çalıştırma tamam'"

# ---------------------------------------------------------------------
baslik "3. Değişiklik replikaya geçti (çıktılar REPLİKADAN)"

sleep 2
calistir "$REPLIKA_ROOT -e \"SHOW REPLICA STATUS\\G\" | grep -E 'Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source|Last_SQL_Error:'"
calistir "$REPLIKA_ROOT yemekhane -e \"SHOW CREATE TABLE rezervasyonlar\\G\""
calistir "$REPLIKA_ROOT yemekhane -e \"SHOW CREATE TABLE ogunler\\G\""
calistir "$REPLIKA_ROOT yemekhane -e \"SHOW CREATE TABLE kullanici_alerjenleri\\G\""
not "Güncellenmiş sp_rezervasyon_yap replikada da var (3 parametre)"
calistir "$REPLIKA -e \"SELECT ORDINAL_POSITION AS sira, PARAMETER_NAME AS parametre, DTD_IDENTIFIER AS tur FROM information_schema.PARAMETERS WHERE SPECIFIC_SCHEMA = 'yemekhane' AND SPECIFIC_NAME = 'sp_rezervasyon_yap' ORDER BY ORDINAL_POSITION\""
not "Mevcut veri bozulmadı: eski rezervasyonların hepsi 'tam', sayı ve bakiye toplamı aynı (replika)"
calistir "$REPLIKA -e \"SELECT porsiyon, COUNT(*) AS adet FROM rezervasyonlar GROUP BY porsiyon\""
calistir "$REPLIKA -e \"SELECT ad, yarim_oran FROM ogunler ORDER BY sira\""
calistir "$REPLIKA -e \"SELECT COUNT(*) AS rezervasyon, (SELECT SUM(bakiye) FROM kullanicilar) AS toplam_bakiye, (SELECT SUM(tutar) FROM bakiye_hareketleri) AS hareket_toplami FROM rezervasyonlar\""

# ---------------------------------------------------------------------
baslik "4. Yeni uygulama derlenip başlatılır"

calistir "docker compose up -d --build uygulama 2>&1 | tail -4"
saglikli_bekle uygulama
calistir "docker compose ps uygulama"

# ---------------------------------------------------------------------
baslik "5. Redis'te eski yapıdaki menü kayıtlarının temizlenmesi"

not "Eski kayıtlarda yarım porsiyon alanları ve yapı sürümü (surum) yok"
calistir "$REDIS --scan --pattern 'menu:*'"
calistir "$REDIS GET $OGLE_ANAHTAR | grep -o '\"surum\":[0-9]*\\|\"yarim_oran\":[0-9.]*' || echo '(surum ve yarim_oran alanı yok: eski yapı)'"
calistir "docker compose exec -T redis sh -c \"redis-cli --scan --pattern 'menu:*' | xargs -r redis-cli DEL\""
calistir "$REDIS --scan --pattern 'menu:*' | wc -l"
not "Yeni uygulama menüyü yeni yapıda önbelleğe alır"
giris
calistir "curl -s -o /dev/null -w 'HTTP %{http_code}\n' -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=2'"
calistir "$REDIS GET $OGLE_ANAHTAR | grep -o '\"surum\":[0-9]*\\|\"yarim_oran\":[0-9.]*\\|\"ogrenci_yarim_fiyati\":[0-9.]*'"

# ---------------------------------------------------------------------
baslik "6. Yarım porsiyon"

OGLE_ID=$(curl -s -b "$OGRENCI" "$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=2" | grep -o '"menu_id":[0-9]*' | head -1 | cut -d: -f2)
KAHVALTI_ID=$(curl -s -b "$OGRENCI" "$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=1" | grep -o '"menu_id":[0-9]*' | head -1 | cut -d: -f2)

# Hazırlık: Mehmet'in bu menüde aktif rezervasyonu varsa iptal edilir (betik tekrar çalıştırılabilsin)
ESKI_REZ=$($KAYNAK -N -e "SELECT id FROM rezervasyonlar WHERE kullanici_id = 7 AND menu_id = $OGLE_ID AND durum = 'aktif'" 2>/dev/null | tr -dc '0-9')
if [ -n "$ESKI_REZ" ]; then
    not "Hazırlık: bu menüdeki mevcut rezervasyon ($ESKI_REZ) iptal edilir"
    calistir "curl -s -b $OGRENCI -X DELETE $ADRES/rezervasyonlar/$ESKI_REZ"
    echo | tee -a "$CIKTI"
fi

not "Yarının öğle menüsü: tam ve yarım fiyat (öğrenci)"
calistir "curl -s -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=2' | grep -o '\"fiyat\":[0-9.]*\\|\"yarim_fiyat\":[0-9.]*\\|\"fiyat_turu\":\"[a-z]*\"'"
not "Yarım porsiyon rezervasyon: ücret tam fiyatın %60'ı"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI -X POST -H '$JSON' -d '{\"menu_id\":$OGLE_ID,\"porsiyon\":\"yarim\"}' $ADRES/rezervasyonlar"
sleep 1
calistir "$REPLIKA -e \"SELECT r.id, r.menu_id, r.porsiyon, r.ucret, r.durum, h.tutar, h.aciklama FROM rezervasyonlar r JOIN bakiye_hareketleri h ON h.rezervasyon_id = r.id AND h.tur = 'rezervasyon' WHERE r.kullanici_id = 7 AND r.menu_id = $OGLE_ID ORDER BY h.id DESC LIMIT 1\""
not "Kahvaltıda yarım porsiyon yok: yordamın mesajı olduğu gibi döner"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI -X POST -H '$JSON' -d '{\"menu_id\":$KAHVALTI_ID,\"porsiyon\":\"yarim\"}' $ADRES/rezervasyonlar"
not "Geçersiz porsiyon değeri"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI -X POST -H '$JSON' -d '{\"menu_id\":$OGLE_ID,\"porsiyon\":\"ceyrek\"}' $ADRES/rezervasyonlar"

# ---------------------------------------------------------------------
baslik "7. Alerjen uyarısı"

not "Mehmet profilinde Gluten (1) ve Süt (7) seçer"
calistir "curl -s -w ' HTTP %{http_code}\n' -b $OGRENCI -X PUT -H '$JSON' -d '{\"alerjen_idler\":[1,7]}' $ADRES/profil/alerjenler"
sleep 1
calistir "$REPLIKA -e \"SELECT ka.kullanici_id, a.id AS alerjen_id, a.ad FROM kullanici_alerjenleri ka JOIN alerjenler a ON a.id = ka.alerjen_id WHERE ka.kullanici_id = 7\""
not "Menüde bu alerjenleri içeren yemekler işaretlenir"
calistir "curl -s -b $OGRENCI '$ADRES/menu?yemekhane=1&tarih=$YARIN&ogun=2' | grep -o '\"ad\":\"[^\"]*\",\"kategori\"\\|\"uyari_alerjenler\":\\[[^]]*\\]\\|\"uyarili_yemek_sayisi\":[0-9]*' | sed 's/,\"kategori\"//'"
not "Haftalık menüde uyarılı menüler"
calistir "curl -s -b $OGRENCI '$ADRES/menuler/hafta?yemekhane=1' | grep -o '\"tarih\":\"[0-9-]*\",\"ogun_id\":[0-9],\"ogun\":\"[^\"]*\"\\|\"alerjen_uyarisi\":[a-z]*' | paste -d ' ' - - | head -9"

curl -s -o /dev/null -b "$OGRENCI" -X DELETE "$ADRES/oturum"
rm -f "$OGRENCI"
printf '\nBitti. Çıktı: %s\n' "$CIKTI"
