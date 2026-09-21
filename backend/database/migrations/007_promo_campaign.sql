-- =============================================================================
-- 007 — PROMO CAMPAIGN (promotional modal artwork + scheduling)
--
-- A campaign is the MARKETING artifact: the artwork, the call-to-action and
-- when it runs. It is deliberately NOT the discount.
--
--   promotion       = the discount engine (code, %, caps, redemptions)
--   promo_campaign  = the artwork shown to a visitor
--
-- They are linked by a NULLABLE promotion_id, because the two do not always
-- come together:
--   * "Friday 15% off"        -> campaign + promotion (code FRIDAY15)
--   * "NEW! Biscoff Iced Coffee" -> campaign only, promotion_id IS NULL
--   * a code emailed to a customer -> promotion only, no campaign
--
-- Keeping them apart means an announcement-only modal never has to invent a
-- fake discount code, and one code can back several campaigns (modal today,
-- homepage banner next week) without being duplicated.
-- =============================================================================

CREATE TABLE IF NOT EXISTS promo_campaign (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150) NOT NULL COMMENT 'Internal label for the admin list, e.g. "Friday Special"',

  -- Optional discount this campaign advertises. ON DELETE SET NULL: deleting a
  -- promotion must not take its artwork with it — the campaign simply stops
  -- showing a code.
  promotion_id INT UNSIGNED NULL,

  -- The artwork IS the content. Two variants so an Instagram-shaped vertical
  -- promo does not get letterboxed on desktop, and a wide banner does not
  -- become unreadable on a phone. Either may be NULL; the client falls back to
  -- whichever one exists, and the service layer requires at least one.
  image_desktop_url VARCHAR(512) NULL,
  image_mobile_url  VARCHAR(512) NULL,
  -- Required when an image is set: the artwork carries the entire message, so
  -- without this a screen-reader user gets nothing at all.
  image_alt         VARCHAR(255) NULL,

  button_text  VARCHAR(80)  NULL COMMENT 'CTA label, e.g. "Order Now". NULL hides the button.',
  button_url   VARCHAR(255) NULL COMMENT 'Internal path, e.g. /order',

  -- How often one visitor sees it. Enforced client-side against localStorage:
  -- the modal targets anonymous marketing traffic, where there is no account to
  -- record impressions against.
  frequency    VARCHAR(20)  NOT NULL DEFAULT 'once_per_day'
               COMMENT 'once_per_day | once_per_session | always',

  starts_on    DATE NOT NULL,
  ends_on      DATE NULL COMMENT 'NULL = runs indefinitely',

  -- Tie-break when several campaigns are live on the same day. Highest wins.
  priority     INT UNSIGNED NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,

  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_promo_campaign_live (is_active, starts_on, ends_on),
  KEY idx_promo_campaign_promotion (promotion_id),

  CONSTRAINT fk_promo_campaign_promotion
    FOREIGN KEY (promotion_id) REFERENCES promotion (id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT chk_promo_campaign_frequency
    CHECK (frequency IN ('once_per_day', 'once_per_session', 'always')),

  -- An open-ended campaign is fine; a backwards one is not.
  CONSTRAINT chk_promo_campaign_dates
    CHECK (ends_on IS NULL OR ends_on >= starts_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- promo_campaign_day
--
-- Which weekdays the campaign runs on. day_of_week follows MySQL DAYOFWEEK()
-- (1=Sunday ... 7=Saturday), matching service_period_schedule so both can be
-- compared against DAYOFWEEK() with no offset arithmetic.
--
-- NOTE the semantics differ from service_period_schedule on purpose:
-- there, no row means CLOSED. Here, NO ROWS AT ALL means the campaign runs
-- EVERY day — an admin who picks no weekday means "always", not "never".
-- Once any day is selected, only those days run.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_campaign_day (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  promo_campaign_id INT UNSIGNED     NOT NULL,
  day_of_week       TINYINT UNSIGNED NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_promo_campaign_day (promo_campaign_id, day_of_week),

  CONSTRAINT fk_promo_campaign_day_campaign
    FOREIGN KEY (promo_campaign_id) REFERENCES promo_campaign (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT chk_promo_campaign_day_range
    CHECK (day_of_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
