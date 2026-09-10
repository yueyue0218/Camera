-- Provider style catalog required by ProviderProfileMapper and ProviderStyleTagMapper.
-- Safe for both fresh initialization and P3-history databases.

CREATE TABLE IF NOT EXISTS style_tags (
    id       BIGINT      PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(40) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'STYLE',
    enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
    UNIQUE KEY uk_style_tag_name (name),
    KEY idx_style_tag_category (category, enabled)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Style, scene and searchable tags';

CREATE TABLE IF NOT EXISTS provider_style_tags (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider_profile_id BIGINT NOT NULL,
    tag_id              BIGINT NOT NULL,
    UNIQUE KEY uk_provider_style_tag (provider_profile_id, tag_id),
    CONSTRAINT fk_provider_style_profile
        FOREIGN KEY (provider_profile_id) REFERENCES provider_profiles(id),
    CONSTRAINT fk_provider_style_tag
        FOREIGN KEY (tag_id) REFERENCES style_tags(id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Provider style tags';
