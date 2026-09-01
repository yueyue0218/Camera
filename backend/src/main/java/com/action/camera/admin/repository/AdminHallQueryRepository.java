package com.action.camera.admin.repository;

import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.dto.AdminModerationFilter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class AdminHallQueryRepository {

    private static final String FILTERED_IDS = """
            SELECT 'DEMAND' AS item_type, d.id AS item_id, d.created_at AS created_at
            FROM demands d
            WHERE (:type IN ('ALL', 'DEMAND'))
              AND (:status = 'ALL'
                   OR (:status = 'VISIBLE' AND d.moderation_status = 'VISIBLE')
                   OR (:status = 'HIDDEN' AND d.moderation_status = 'HIDDEN')
                   OR (:status = 'REPORTED' AND EXISTS (
                        SELECT 1 FROM reports r
                        WHERE r.target_type = 'DEMAND'
                          AND r.target_id = d.id
                          AND r.status = 'PENDING')))
              AND (:keyword IS NULL OR LOWER(CONCAT_WS(' ', d.scene, d.description, d.location, d.customer_id))
                   LIKE CONCAT('%', LOWER(:keyword), '%'))
            UNION ALL
            SELECT 'SERVICE_PACKAGE' AS item_type, s.id AS item_id, s.created_at AS created_at
            FROM service_packages s
            WHERE (:type IN ('ALL', 'SERVICE_PACKAGE'))
              AND (:status = 'ALL'
                   OR (:status = 'VISIBLE' AND s.moderation_status = 'VISIBLE')
                   OR (:status = 'HIDDEN' AND s.moderation_status = 'HIDDEN')
                   OR (:status = 'REPORTED' AND EXISTS (
                        SELECT 1 FROM reports r
                        WHERE r.target_type = 'SERVICE_PACKAGE'
                          AND r.target_id = s.id
                          AND r.status = 'PENDING')))
              AND (:keyword IS NULL OR LOWER(CONCAT_WS(' ', s.title, s.description, s.scene,
                                                       s.service_area, s.provider_id))
                   LIKE CONCAT('%', LOWER(:keyword), '%'))
            """;

    private static final String PAGE_SQL = """
            SELECT item_type, item_id, created_at
            FROM (
            """ + FILTERED_IDS + """
            ) hall_items
            ORDER BY created_at DESC, item_type ASC, item_id DESC
            LIMIT :limit OFFSET :offset
            """;

    private static final String COUNT_SQL = """
            SELECT COUNT(*)
            FROM (
            """ + FILTERED_IDS + """
            ) hall_items
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AdminHallQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public HallIdPage findPage(AdminHallItemType type,
                               AdminModerationFilter status,
                               String keyword,
                               int limit,
                               int offset) {
        MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("type", type.name())
                .addValue("status", status.name())
                .addValue("keyword", keyword)
                .addValue("limit", limit)
                .addValue("offset", offset);
        Long total = jdbcTemplate.queryForObject(COUNT_SQL, parameters, Long.class);
        List<HallItemId> ids = jdbcTemplate.query(PAGE_SQL, parameters, (resultSet, rowNumber) -> {
            Timestamp timestamp = resultSet.getTimestamp("created_at");
            return new HallItemId(
                    AdminHallItemType.valueOf(resultSet.getString("item_type")),
                    resultSet.getLong("item_id"),
                    timestamp == null ? null : timestamp.toLocalDateTime());
        });
        return new HallIdPage(ids, total == null ? 0L : total);
    }

    public record HallItemId(AdminHallItemType type, Long id, LocalDateTime createdAt) {
    }

    public record HallIdPage(List<HallItemId> records, long total) {
    }
}
