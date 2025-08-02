-- 1) Create the roles lookup table
CREATE TABLE roles (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50)       NOT NULL UNIQUE,      -- e.g. 'admin', 'user'
  description VARCHAR(255) DEFAULT NULL,       -- optional human‐readable desc
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- 2) Seed it with your two roles
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator: full access to all features'),
  ('user',  'Normal user: standard trading privileges');

-- 3) Alter users to point at roles.id
ALTER TABLE users
  ADD COLUMN role_id TINYINT UNSIGNED NOT NULL
    DEFAULT (SELECT id FROM roles WHERE name = 'user'),
  ADD INDEX idx_users_role_id (role_id),
  ADD CONSTRAINT fk_users_roles
    FOREIGN KEY (role_id) REFERENCES roles(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;

