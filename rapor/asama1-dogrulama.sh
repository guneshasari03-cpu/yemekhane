#!/usr/bin/env bash
# =====================================================================
# Aşama 1 · Altyapı doğrulaması
# Her komutu ve çıktısını hem ekrana hem rapor/asama1-cikti.txt dosyasına yazar.
#
# Depo kökünden çalıştırın (Windows'ta Git Bash ile):
#   docker compose up -d
#   bash rapor/asama1-dogrulama.sh
# =====================================================================
set -u
cd "$(dirname "$0")/.."

CIKTI=rapor/asama1-cikti.txt
: > "$CIKTI"

# Kısaltmalar (komutlar raporda açık haliyle görünsün diye yalnızca okunabilirlik için)
KAYNAK='docker compose exec -T mysql-primary mysql --default-character-set=utf8mb4 -t -uyemekhane_app -pUyg_2026 yemekhane'
REPLIKA='docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -t -uyemekhane_app -pUyg_2026 yemekhane'
REPLIKA_ROOT='docker compose exec -T mysql-replica mysql --default-character-set=utf8mb4 -uroot -pyemekhane_kok'

baslik() {
    printf '\n==================================================================\n%s\n==================================================================\n' "$1" | tee -a "$CIKTI"
}

# Komutu yazar, çalıştırır, çıktısını kaydeder. Parola uyarısı satırı atlanır.
calistir() {
    printf '\n$ %s\n' "$1" | tee -a "$CIKTI"
    eval "$1" 2>&1 | grep -av "Using a password on the command line" | tee -a "$CIKTI"
}

# Bir servisin healthcheck durumu "healthy" olana kadar bekler
saglikli_bekle() {
    local servis=$1 durum=""
    for _ in $(seq 1 60); do
        durum=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q "$servis")" 2>/dev/null)
        [ "$durum" = "healthy" ] && return 0
        sleep 2
    done
    echo "UYARI: $servis 120 saniyede healthy olmadı (durum: $durum)" | tee -a "$CIKTI"
}

# replica-setup işini bitirip çıkana kadar bekler
replica_setup_bekle() {
    local durum=""
    for _ in $(seq 1 90); do
        durum=$(docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' "$(docker compose ps -aq replica-setup)" 2>/dev/null)
        case "$durum" in
            "exited 0") return 0 ;;
            exited*)    echo "UYARI: replica-setup hatayla çıktı ($durum). docker compose logs replica-setup" | tee -a "$CIKTI"; return 1 ;;
        esac
        sleep 2
    done
    echo "UYARI: replica-setup 180 saniyede bitmedi" | tee -a "$CIKTI"
}

echo "Servislerin hazır olması bekleniyor..."
saglikli_bekle mysql-primary
saglikli_bekle mysql-replica
replica_setup_bekle

echo "Aşama 1 doğrulaması · $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$CIKTI"

# ---------------------------------------------------------------------
baslik "1. Tüm servisler healthy, replica-setup Exited (0)"
calistir 'docker compose ps -a'
calistir 'docker compose logs replica-setup'
calistir "$REPLIKA_ROOT -e \"SHOW REPLICA STATUS\\G\" | grep -E 'Source_Host|Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source|Last_IO_Error:|Last_SQL_Error:'"

# ---------------------------------------------------------------------
baslik "2. Kaynakta yapılan bakiye yüklemesi replikada görünüyor"
calistir "$KAYNAK -e \"SELECT id, ad, soyad, bakiye FROM kullanicilar WHERE id = 7\""
calistir "$KAYNAK -e \"CALL sp_bakiye_yukle(7, 100)\""
sleep 1
calistir "$REPLIKA -e \"SELECT id, ad, soyad, bakiye FROM kullanicilar WHERE id = 7\""
calistir "$REPLIKA -e \"SELECT id, tur, tutar, aciklama, olusturma FROM bakiye_hareketleri WHERE kullanici_id = 7 ORDER BY id DESC LIMIT 1\""

# ---------------------------------------------------------------------
baslik "3. Replikaya yazma denemesi read-only hatasıyla reddediliyor"
calistir "$REPLIKA -e \"SELECT @@read_only, @@super_read_only\""
calistir "$REPLIKA -e \"CALL sp_bakiye_yukle(7, 50)\""
calistir "$REPLIKA -e \"UPDATE kullanicilar SET bakiye = 0 WHERE id = 7\""

# ---------------------------------------------------------------------
baslik "4. Replika durdurulup başlatıldığında aradaki değişiklikleri yakalıyor"
calistir 'docker compose stop mysql-replica'
calistir 'docker compose ps -a mysql-replica'
calistir "$KAYNAK -e \"CALL sp_bakiye_yukle(7, 200)\""
calistir "$KAYNAK -e \"SELECT id, bakiye FROM kullanicilar WHERE id = 7\""
calistir 'docker compose start mysql-replica'
saglikli_bekle mysql-replica
sleep 2
calistir 'docker compose ps -a mysql-replica'
calistir "$REPLIKA -e \"SELECT id, bakiye FROM kullanicilar WHERE id = 7\""
calistir "$REPLIKA_ROOT -e \"SHOW REPLICA STATUS\\G\" | grep -E 'Replica_IO_Running|Replica_SQL_Running:|Seconds_Behind_Source|Retrieved_Gtid_Set|Executed_Gtid_Set'"

# ---------------------------------------------------------------------
baslik "Ek: bakiye = hareketlerin toplamı kuralı replikada da tutuyor"
calistir "$REPLIKA -e \"SELECT k.id, k.bakiye, SUM(h.tutar) AS hareket_toplami FROM kullanicilar k JOIN bakiye_hareketleri h ON h.kullanici_id = k.id WHERE k.id = 7 GROUP BY k.id, k.bakiye\""

# ---------------------------------------------------------------------
baslik "Ek: Redis çalışıyor"
calistir 'docker compose exec -T redis redis-cli ping'

printf '\nBitti. Çıktı: %s\n' "$CIKTI"
