CREATE TABLE localisations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  name VARCHAR(255)          NOT NULL,               -- e.g. "Warsaw Central Station"
  latitude DECIMAL(9,6)      NOT NULL,               -- signed degrees, ±DD.DDDDDD
  longitude DECIMAL(9,6)     NOT NULL,               -- signed degrees, ±DDD.DDDDDD

  created_by INT UNSIGNED    NOT NULL,               -- FK to users.id

  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_localisations_created_by (created_by),
  CONSTRAINT fk_localisations_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

