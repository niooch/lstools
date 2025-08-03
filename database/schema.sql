-- 1) Create the database
CREATE DATABASE IF NOT EXISTS route_trading
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
USE route_trading;

-- 2) users table
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255)         NOT NULL UNIQUE,
  username VARCHAR(50)       NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone_country_code VARCHAR(5) NOT NULL,
  phone_number VARCHAR(20)      NOT NULL,
  first_name VARCHAR(100)    NOT NULL,
  last_name VARCHAR(100)     NOT NULL,
  description TEXT            NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) roles table + seed data
CREATE TABLE roles (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator: full access to all features'),
  ('user',  'Normal user: standard trading privileges');

ALTER TABLE users
  ADD COLUMN role_id TINYINT UNSIGNED NOT NULL DEFAULT 2,
  ADD INDEX (role_id),
  ADD CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

-- 4) localisations table
CREATE TABLE localisations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255)        NOT NULL,
  latitude DECIMAL(9,6)    NOT NULL,
  longitude DECIMAL(9,6)   NOT NULL,
  created_by INT UNSIGNED  NOT NULL,
  created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX (created_by),
  CONSTRAINT fk_localisations_users FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) vehicle_types table
CREATE TABLE vehicle_types (
  id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) routes table
CREATE TABLE routes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  start_location_id INT UNSIGNED NOT NULL,
  end_location_id   INT UNSIGNED NOT NULL,
  posted_by         INT UNSIGNED NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at        DATE      NOT NULL,
  vehicle_type_id   TINYINT UNSIGNED NOT NULL,
  route_mode        ENUM('single','team') NOT NULL DEFAULT 'single',
  PRIMARY KEY (id),
  INDEX (start_location_id),
  INDEX (end_location_id),
  INDEX (posted_by),
  INDEX (vehicle_type_id),
  CONSTRAINT fk_routes_start FOREIGN KEY (start_location_id) REFERENCES localisations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_routes_end   FOREIGN KEY (end_location_id)   REFERENCES localisations(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_routes_user  FOREIGN KEY (posted_by)          REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_routes_vehicle FOREIGN KEY (vehicle_type_id)  REFERENCES vehicle_types(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
