CREATE TABLE routes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- start and end points
  start_location_id INT UNSIGNED NOT NULL,
  end_location_id   INT UNSIGNED NOT NULL,

  -- who posted the route
  posted_by INT UNSIGNED NOT NULL,

  -- timing
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATE      NOT NULL,               -- date by which the route is no longer valid

  -- vehicle and participation
  vehicle_type_id TINYINT UNSIGNED NOT NULL,
  route_mode      ENUM('single','team') NOT NULL DEFAULT 'single',

  PRIMARY KEY (id),

  -- indexes for lookups
  INDEX idx_routes_start   (start_location_id),
  INDEX idx_routes_end     (end_location_id),
  INDEX idx_routes_poster  (posted_by),
  INDEX idx_routes_vehicle (vehicle_type_id),

  -- foreign-key constraints
  CONSTRAINT fk_routes_start
    FOREIGN KEY (start_location_id) REFERENCES localisations(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
  CONSTRAINT fk_routes_end
    FOREIGN KEY (end_location_id)   REFERENCES localisations(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
  CONSTRAINT fk_routes_user
    FOREIGN KEY (posted_by)          REFERENCES users(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT,
  CONSTRAINT fk_routes_vehicle
    FOREIGN KEY (vehicle_type_id)    REFERENCES vehicle_types(id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

