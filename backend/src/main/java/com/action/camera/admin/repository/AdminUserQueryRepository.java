package com.action.camera.admin.repository;

import com.action.camera.admin.dto.AdminUserListItemResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Repository
public class AdminUserQueryRepository {

    private static final String ADMIN_PREDICATE = """
            (u.current_role = 'ADMIN' OR EXISTS (
                SELECT 1 FROM user_role_bindings urb
                WHERE urb.user_id = u.id AND urb.role = 'ADMIN'
            ))
            """;

    private static final String FILTER = """
            WHERE (:keyword IS NULL
                   OR LOWER(u.nickname) LIKE :keywordLike
                   OR (:keywordUserId IS NOT NULL AND u.id = :keywordUserId)
                   OR u.student_no = :keyword)
              AND (:status IS NULL OR u.status = :status)
              AND (:role IS NULL
                   OR (:role = 'ADMIN' AND
            """ + ADMIN_PREDICATE + """
                   )
                   OR (:role <> 'ADMIN' AND u.current_role = :role))
            """;

    private static final String PAGE_SQL = """
            SELECT u.id, u.nickname, u.avatar_file_id, u.current_role, u.status,
                   u.school, u.city_code, u.created_at,
                   CASE WHEN
            """ + ADMIN_PREDICATE + """
                   THEN TRUE ELSE FALSE END AS admin_capable,
                   (SELECT COUNT(*) FROM reports r
                    WHERE r.target_type = 'USER' AND r.target_id = u.id AND r.status = 'PENDING')
                    AS pending_report_count
            FROM users u
            """ + FILTER + """
            ORDER BY u.created_at DESC, u.id DESC
            LIMIT :limit OFFSET :offset
            """;

    private static final String COUNT_SQL = """
            SELECT COUNT(DISTINCT u.id)
            FROM users u
            """ + FILTER;

    private static final String DETAIL_SUMMARY_SQL = """
            SELECT
              (SELECT sc.status FROM student_certifications sc
               WHERE sc.user_id = :userId ORDER BY sc.applied_at DESC, sc.id DESC LIMIT 1)
                AS student_certification_status,
              (SELECT rc.status FROM real_name_certifications rc
               WHERE rc.user_id = :userId ORDER BY rc.created_at DESC, rc.id DESC LIMIT 1)
                AS real_name_certification_status,
              (SELECT COUNT(*) FROM demands d
               WHERE d.customer_id = :userId AND d.status = 'OPEN'
                 AND d.moderation_status = 'VISIBLE' AND d.hidden_by_customer = FALSE)
                AS public_demand_count,
              (SELECT COUNT(*) FROM service_packages s
               WHERE s.provider_id = :userId AND s.status = 'ONLINE' AND s.is_available = TRUE
                 AND s.moderation_status = 'VISIBLE' AND s.hidden_by_provider = FALSE)
                AS public_service_count,
              (SELECT COUNT(*) FROM moment_posts m
               WHERE m.author_id = :userId AND m.status = 'PUBLISHED'
                 AND m.moderation_status = 'VISIBLE')
                AS public_moment_count,
              (SELECT COUNT(*) FROM reports r
               WHERE r.target_type = 'USER' AND r.target_id = :userId)
                AS total_report_count,
              (SELECT COUNT(*) FROM reports r
               WHERE r.target_type = 'USER' AND r.target_id = :userId AND r.status = 'PENDING')
                AS pending_report_count
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public AdminUserQueryRepository(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public UserPage findPage(String keyword,
                             Long keywordUserId,
                             String role,
                             String status,
                             int limit,
                             int offset) {
        MapSqlParameterSource parameters = parameters(keyword, keywordUserId, role, status)
                .addValue("limit", limit)
                .addValue("offset", offset);
        Long total = jdbcTemplate.queryForObject(COUNT_SQL, parameters, Long.class);
        List<AdminUserListItemResponse> records = jdbcTemplate.query(PAGE_SQL, parameters, (rs, rowNum) -> {
            Timestamp createdAt = rs.getTimestamp("created_at");
            Long avatarFileId = (Long) rs.getObject("avatar_file_id");
            return new AdminUserListItemResponse(
                    rs.getLong("id"),
                    rs.getString("nickname"),
                    avatarFileId,
                    rs.getString("current_role"),
                    rs.getBoolean("admin_capable"),
                    rs.getString("status"),
                    rs.getString("school"),
                    rs.getString("city_code"),
                    createdAt == null ? null : createdAt.toLocalDateTime(),
                    rs.getLong("pending_report_count"));
        });
        return new UserPage(records, total == null ? 0L : total);
    }

    public DetailSummary detailSummary(Long userId) {
        return jdbcTemplate.queryForObject(
                DETAIL_SUMMARY_SQL,
                new MapSqlParameterSource("userId", userId),
                (rs, rowNum) -> new DetailSummary(
                        rs.getString("student_certification_status"),
                        rs.getString("real_name_certification_status"),
                        rs.getLong("public_demand_count"),
                        rs.getLong("public_service_count"),
                        rs.getLong("public_moment_count"),
                        rs.getLong("total_report_count"),
                        rs.getLong("pending_report_count")));
    }

    private MapSqlParameterSource parameters(String keyword,
                                              Long keywordUserId,
                                              String role,
                                              String status) {
        return new MapSqlParameterSource()
                .addValue("keyword", keyword, Types.VARCHAR)
                .addValue("keywordLike", keyword == null ? null : "%" + keyword.toLowerCase(Locale.ROOT) + "%", Types.VARCHAR)
                .addValue("keywordUserId", keywordUserId, Types.BIGINT)
                .addValue("role", role, Types.VARCHAR)
                .addValue("status", status, Types.VARCHAR);
    }

    public record UserPage(List<AdminUserListItemResponse> records, long total) {
    }

    public record DetailSummary(
            String studentCertificationStatus,
            String realNameCertificationStatus,
            long publicDemandCount,
            long publicServicePackageCount,
            long publicMomentCount,
            long totalReportCount,
            long pendingReportCount
    ) {
    }
}
