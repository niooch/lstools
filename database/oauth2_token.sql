CREATE TABLE IF NOT EXISTS oauth2_token (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_id      VARCHAR(48) NOT NULL,
  user_id        INT         NOT NULL,
  access_token   VARCHAR(255) NOT NULL UNIQUE,
  refresh_token  VARCHAR(255)             UNIQUE,
  issued_at      DATETIME     NOT NULL,
  expires_in     INT          NOT NULL,
  scope          TEXT,
  revoked        BOOLEAN      NOT NULL DEFAULT FALSE,
  FOREIGN KEY (client_id) REFERENCES oauth2_client(client_id)
    ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

