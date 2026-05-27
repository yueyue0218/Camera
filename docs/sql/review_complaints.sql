CREATE TABLE review_complaints (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    review_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    complainant_id BIGINT NOT NULL,
    respondent_id BIGINT NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    evidence_file_ids VARCHAR(500),
    status VARCHAR(30) NOT NULL,
    arbitration_result VARCHAR(30),
    arbitration_comment VARCHAR(1000),
    handled_by BIGINT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    handled_at DATETIME,
    INDEX idx_review_complaints_review_id (review_id),
    INDEX idx_review_complaints_complainant_id (complainant_id),
    INDEX idx_review_complaints_status_created_at (status, created_at)
);
