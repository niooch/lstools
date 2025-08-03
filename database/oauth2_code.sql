CREATE TABLE IF NOT EXISTS oauth2_code (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(120) NOT NULL UNIQUE,
  client_id   VARCHAR(48)  NOT NULL,
  redirect_uri TEXT,
  scope       TEXT,
  user_id     INT          NOT NULL,
  created_at  DATETIME     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  FOREIGN KEY (client_id) REFERENCES oauth2_client(client_id)
    ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

