-- Moments 动态模块表结构

CREATE TABLE IF NOT EXISTS moment_posts
(
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    author_id    BIGINT       NOT NULL COMMENT '作者用户 ID',
    author_role  VARCHAR(20)  NOT NULL COMMENT '作者角色',
    title        VARCHAR(50)  NULL COMMENT '动态标题',
    content      VARCHAR(1000) NULL COMMENT '动态正文',
    status       VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED' COMMENT 'PUBLISHED / DELETED',
    created_at   DATETIME     NOT NULL COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL COMMENT '更新时间',
    deleted_at   DATETIME     NULL COMMENT '删除时间',
    KEY idx_moment_posts_author_created (author_id, created_at),
    KEY idx_moment_posts_status_created (status, created_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '动态主表';

CREATE TABLE IF NOT EXISTS moment_images
(
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    moment_id   BIGINT       NOT NULL COMMENT '动态 ID',
    image_data  VARCHAR(2048) NOT NULL COMMENT '图片数据或地址',
    sort_order  INT          NOT NULL COMMENT '图片顺序',
    is_cover    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否封面图',
    created_at  DATETIME     NOT NULL COMMENT '创建时间',
    UNIQUE KEY uk_moment_images_moment_sort (moment_id, sort_order),
    KEY idx_moment_images_moment_id (moment_id),
    CONSTRAINT fk_moment_images_moment
        FOREIGN KEY (moment_id) REFERENCES moment_posts (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '动态图片表';

CREATE TABLE IF NOT EXISTS moment_mentions
(
    moment_id   BIGINT       NOT NULL COMMENT '动态 ID',
    sort_order  INT          NOT NULL COMMENT '提及顺序',
    mention     VARCHAR(100) NOT NULL COMMENT '提及内容',
    PRIMARY KEY (moment_id, sort_order),
    CONSTRAINT fk_moment_mentions_moment
        FOREIGN KEY (moment_id) REFERENCES moment_posts (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '动态提及表';

CREATE TABLE IF NOT EXISTS moment_likes
(
    moment_id   BIGINT NOT NULL COMMENT '动态 ID',
    user_id     BIGINT NOT NULL COMMENT '点赞用户 ID',
    PRIMARY KEY (moment_id, user_id),
    CONSTRAINT fk_moment_likes_moment
        FOREIGN KEY (moment_id) REFERENCES moment_posts (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '动态点赞表';

CREATE TABLE IF NOT EXISTS moment_favorites
(
    moment_id   BIGINT NOT NULL COMMENT '动态 ID',
    user_id     BIGINT NOT NULL COMMENT '收藏用户 ID',
    PRIMARY KEY (moment_id, user_id),
    CONSTRAINT fk_moment_favorites_moment
        FOREIGN KEY (moment_id) REFERENCES moment_posts (id)
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '动态收藏表';

CREATE TABLE IF NOT EXISTS user_follows
(
    id                 BIGINT PRIMARY KEY AUTO_INCREMENT,
    follower_id        BIGINT      NOT NULL COMMENT '关注者用户 ID',
    following_user_id  BIGINT      NOT NULL COMMENT '被关注者用户 ID',
    created_at         DATETIME    NOT NULL COMMENT '创建时间',
    UNIQUE KEY uk_user_follows_pair (follower_id, following_user_id),
    KEY idx_user_follows_follower (follower_id),
    KEY idx_user_follows_following (following_user_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '用户关注关系表';
