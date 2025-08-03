CREATE TABLE vehicle_types (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100)      NOT NULL UNIQUE,   -- e.g. 'truck', 'van', 'bike', etc.
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

