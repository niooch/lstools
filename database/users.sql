CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  
  -- login & identity
  email VARCHAR(255)           NOT NULL UNIQUE,
  username VARCHAR(50)         NOT NULL UNIQUE,
  password_hash VARCHAR(255)   NOT NULL,
  
  -- contact
  phone_country_code VARCHAR(5)  NOT NULL,  -- e.g. '+48'
  phone_number VARCHAR(20)        NOT NULL,  -- e.g. '501234567'
  
  -- personal
  first_name VARCHAR(100)      NOT NULL,
  last_name  VARCHAR(100)      NOT NULL,
  description TEXT             NULL,
  
  -- record-keeping
  created_at TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

