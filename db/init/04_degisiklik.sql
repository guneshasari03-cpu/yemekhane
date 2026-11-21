-- =====================================================================
-- Yemekhane Otomasyonu · Aşama 4 · Değişiklik talebi (migration)
--
--  1) Yarım porsiyon: öğle ve akşam menülerinde seçilebilir, ücret tam
--     fiyatın %60'ıdır. Kahvaltıda yarım porsiyon yoktur. Geçmiş
--     rezervasyonlar tam porsiyon sayılır.
--  2) Alerjen uyarısı: kullanıcı profilinde alerjenlerini seçer.
--
-- Çalışan sistemde KAYNAKTA çalıştırılır; değişiklik replikaya binlog ile
-- geçer, replikaya ayrıca uygulanmaz:
--   docker compose exec -T mysql-primary mysql -uroot -pyemekhane_kok yemekhane < db/init/04_degisiklik.sql
-- Sıfırdan kurulumda (boş volume) 01 ve 02'den sonra kendiliğinden çalışır.
--
-- Mevcut veri korunur: yalnızca yeni tablo ve varsayılan değerli yeni
-- sütunlar eklenir, hiçbir satır silinmez. Dosya tekrar çalıştırılabilir
-- (ikinci çalıştırmada hata vermez, veriyi değiştirmez).
-- =====================================================================
SET NAMES utf8mb4;
USE yemekhane;

-- ---------------------------------------------------------------------
-- Yardımcı: sütun yoksa ekler (MySQL'de ADD COLUMN IF NOT EXISTS yok).
-- Migration sonunda silinir.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _sutun_ekle;
DELIMITER $$
CREATE PROCEDURE _sutun_ekle(IN p_tablo VARCHAR(64), IN p_sutun VARCHAR(64), IN p_tanim TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_tablo AND COLUMN_NAME = p_sutun
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', p_tablo, ' ADD COLUMN ', p_sutun, ' ', p_tanim);
        PREPARE ifade FROM @ddl;
        EXECUTE ifade;
        DEALLOCATE PREPARE ifade;
    END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- 1a. Öğünlerin yarım porsiyon oranı
--     NULL: bu öğünde yarım porsiyon yok (kahvaltı).
--     Kural tek yerde durur: hem sp_rezervasyon_yap hem uygulama buradan okur.
-- ---------------------------------------------------------------------
CALL _sutun_ekle('ogunler', 'yarim_oran',
    'DECIMAL(3,2) NULL DEFAULT NULL COMMENT ''Yarım porsiyon fiyat oranı; NULL ise bu öğünde yarım porsiyon yok'' '
    'CONSTRAINT ck_ogun_yarim_oran CHECK (yarim_oran > 0 AND yarim_oran < 1)');

UPDATE ogunler SET yarim_oran = 0.60
 WHERE ad IN ('Öğle', 'Akşam') AND yarim_oran IS NULL;

-- ---------------------------------------------------------------------
-- 1b. Rezervasyonun porsiyonu
--     Varsayılan 'tam': mevcut (geçmiş) rezervasyonların hepsi tam porsiyon
--     sayılır. Varsayılan değerli sütun eklemek MySQL 8.4'te INSTANT'tır;
--     tablo yeniden yazılmaz, mevcut satırlar değişmez.
-- ---------------------------------------------------------------------
CALL _sutun_ekle('rezervasyonlar', 'porsiyon',
    'ENUM(''tam'',''yarim'') NOT NULL DEFAULT ''tam'' AFTER menu_id');

-- ---------------------------------------------------------------------
-- 2. Kullanıcının alerjenleri
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kullanici_alerjenleri (
    kullanici_id  INT UNSIGNED     NOT NULL,
    alerjen_id    TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (kullanici_id, alerjen_id),
    KEY ix_ka_alerjen (alerjen_id),
    CONSTRAINT fk_ka_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id) ON DELETE CASCADE,
    CONSTRAINT fk_ka_alerjen   FOREIGN KEY (alerjen_id)   REFERENCES alerjenler (id)
) ENGINE=InnoDB;

DROP PROCEDURE _sutun_ekle;

-- ---------------------------------------------------------------------
-- 3. Güncellenmiş sp_rezervasyon_yap
--    Yeni parametre: p_porsiyon ('tam' | 'yarim').
--    Yarım porsiyon ücreti = ROUND(tam fiyat * öğünün yarim_oran'ı, 2).
--    Yarım porsiyon da bir kişilik yer kaplar (kapasite kuralı aynı).
--    İptal yordamı iadeyi rezervasyondaki ucret'ten yaptığı için değişmedi.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rezervasyon_yap;
DELIMITER $$
CREATE PROCEDURE sp_rezervasyon_yap(
    IN p_kullanici_id INT UNSIGNED,
    IN p_menu_id      INT UNSIGNED,
    IN p_porsiyon     VARCHAR(20)
)
BEGIN
    DECLARE v_rol          VARCHAR(10)   DEFAULT NULL;
    DECLARE v_aktif        TINYINT       DEFAULT NULL;
    DECLARE v_bakiye       DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_son          DATETIME      DEFAULT NULL;
    DECLARE v_kapasite     INT           DEFAULT NULL;
    DECLARE v_ogr_fiyat    DECIMAL(8,2)  DEFAULT NULL;
    DECLARE v_per_fiyat    DECIMAL(8,2)  DEFAULT NULL;
    DECLARE v_ogun         VARCHAR(20)   DEFAULT NULL;
    DECLARE v_yarim_oran   DECIMAL(3,2)  DEFAULT NULL;
    DECLARE v_porsiyon     VARCHAR(20)   DEFAULT NULL;
    DECLARE v_ucret        DECIMAL(8,2)  DEFAULT NULL;
    DECLARE v_dolu         INT           DEFAULT 0;
    DECLARE v_mevcut_id    INT UNSIGNED  DEFAULT NULL;
    DECLARE v_mevcut_durum VARCHAR(12)   DEFAULT NULL;
    DECLARE v_rez_id       INT UNSIGNED  DEFAULT NULL;
    DECLARE v_mesaj        VARCHAR(100)  DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    -- Porsiyon verilmezse tam porsiyon
    SET v_porsiyon = COALESCE(p_porsiyon, 'tam');
    IF v_porsiyon NOT IN ('tam', 'yarim') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Porsiyon tam ya da yarım olmalıdır.';
    END IF;

    START TRANSACTION;

    -- Kullanıcı satırını kilitle (eşzamanlı bakiye işlemlerine karşı)
    SELECT rol, aktif, bakiye INTO v_rol, v_aktif, v_bakiye
      FROM kullanicilar WHERE id = p_kullanici_id FOR UPDATE;
    IF v_rol IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kullanıcı bulunamadı.';
    END IF;
    IF v_aktif = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hesabınız pasif durumda.';
    END IF;

    -- Menü satırını kilitle (eşzamanlı kapasite kontrolüne karşı)
    SELECT TIMESTAMP(m.tarih, o.son_saat), yh.kapasite, m.ogrenci_fiyati, m.personel_fiyati,
           o.ad, o.yarim_oran
      INTO v_son, v_kapasite, v_ogr_fiyat, v_per_fiyat, v_ogun, v_yarim_oran
      FROM menuler m
      JOIN ogunler o       ON o.id  = m.ogun_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     WHERE m.id = p_menu_id
       FOR UPDATE;
    IF v_son IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menü bulunamadı.';
    END IF;
    IF NOW() >= v_son THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için rezervasyon süresi doldu.';
    END IF;
    IF v_porsiyon = 'yarim' AND v_yarim_oran IS NULL THEN
        SET v_mesaj = CONCAT(v_ogun, ' menüsünde yarım porsiyon yoktur.');
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_mesaj;
    END IF;

    SELECT id, durum INTO v_mevcut_id, v_mevcut_durum
      FROM rezervasyonlar
     WHERE kullanici_id = p_kullanici_id AND menu_id = p_menu_id
       FOR UPDATE;
    IF v_mevcut_durum IN ('aktif', 'kullanildi') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için zaten rezervasyonunuz var.';
    END IF;

    SELECT COUNT(*) INTO v_dolu
      FROM rezervasyonlar
     WHERE menu_id = p_menu_id AND durum IN ('aktif', 'kullanildi');
    IF v_dolu >= v_kapasite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Yemekhane kapasitesi dolu.';
    END IF;

    SET v_ucret = IF(v_rol = 'ogrenci', v_ogr_fiyat, v_per_fiyat);
    IF v_porsiyon = 'yarim' THEN
        SET v_ucret = ROUND(v_ucret * v_yarim_oran, 2);
    END IF;
    IF v_bakiye < v_ucret THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bakiye yetersiz.';
    END IF;

    IF v_mevcut_id IS NULL THEN
        INSERT INTO rezervasyonlar (kullanici_id, menu_id, porsiyon, durum, ucret)
        VALUES (p_kullanici_id, p_menu_id, v_porsiyon, 'aktif', v_ucret);
        SET v_rez_id = LAST_INSERT_ID();
    ELSE
        -- Daha önce iptal edilmiş kayıt yeniden etkinleşir (porsiyon da güncellenir)
        UPDATE rezervasyonlar
           SET durum = 'aktif', porsiyon = v_porsiyon, ucret = v_ucret, olusturma = NOW(),
               iptal_zamani = NULL, kullanma_zamani = NULL
         WHERE id = v_mevcut_id;
        SET v_rez_id = v_mevcut_id;
    END IF;

    UPDATE kullanicilar SET bakiye = bakiye - v_ucret WHERE id = p_kullanici_id;

    INSERT INTO bakiye_hareketleri (kullanici_id, tur, tutar, rezervasyon_id, aciklama)
    VALUES (p_kullanici_id, 'rezervasyon', -v_ucret, v_rez_id,
            IF(v_porsiyon = 'yarim', 'Rezervasyon (yarım porsiyon)', 'Rezervasyon'));

    COMMIT;

    SELECT v_rez_id AS rezervasyon_id, v_porsiyon AS porsiyon, v_ucret AS ucret,
           v_bakiye - v_ucret AS bakiye;
END$$
DELIMITER ;
