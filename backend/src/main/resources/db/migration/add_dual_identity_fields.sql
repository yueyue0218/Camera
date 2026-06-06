-- STEP 3: Provider-specific avatar (one-time migration; run once on target DB)
ALTER TABLE provider_profiles
    ADD COLUMN provider_avatar_file_id BIGINT NULL;

-- STEP 5: Follow relationships track which identity (role) of the target is being followed
ALTER TABLE user_follows
    ADD COLUMN target_role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER';

-- Replace the 2-column unique index with a 3-column one
ALTER TABLE user_follows
    DROP INDEX uk_user_follows_pair;

ALTER TABLE user_follows
    ADD CONSTRAINT uk_user_follows_triple UNIQUE (follower_id, following_user_id, target_role);
