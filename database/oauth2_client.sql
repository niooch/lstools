CREATE TABLE IF NOT EXISTS oauth2_client (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  client_id            VARCHAR(48)     NOT NULL UNIQUE,
  client_secret        VARCHAR(120)    NOT NULL,
  redirect_uris        TEXT,
  scope                TEXT,
  grant_types          TEXT,
  response_types       TEXT,
  token_endpoint_auth_method VARCHAR(48) DEFAULT 'client_secret_basic'
) ENGINE=InnoDB;

