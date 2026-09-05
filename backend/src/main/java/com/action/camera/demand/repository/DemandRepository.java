package com.action.camera.demand.repository;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DemandRepository extends JpaRepository<Demand, Long> {

    List<Demand> findByStatus(DemandStatus status);

    @Query(value = """
            select d.*
            from demands d
            where d.status = 'OPEN'
              and d.moderation_status = 'VISIBLE'
              and coalesce(d.hidden_by_customer, false) = false
              and (:cityCode is null or lower(d.city_code) = lower(:cityCode))
              and (:scene is null or lower(d.scene) = lower(:scene))
              and (:styleTag is null or instr(lower(coalesce(d.style_tags, '')), concat('\"', lower(:styleTag), '\"')) > 0)
              and (:expectedDate is null or d.expected_date = :expectedDate)
              and (:timeTag is null or instr(coalesce(d.time_tags, ''), concat('\"', :timeTag, '\"')) > 0)
              and (
                    (:minBudgetCent is null and :maxBudgetCent is null)
                    or (
                        (d.budget_min_cent is not null or d.budget_max_cent is not null)
                        and (:minBudgetCent is null or coalesce(d.budget_max_cent, d.budget_min_cent) >= :minBudgetCent)
                        and (:maxBudgetCent is null or coalesce(d.budget_min_cent, d.budget_max_cent) <= :maxBudgetCent)
                    )
              )
              and (
                    :keyword is null
                    or instr(lower(coalesce(d.scene, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.description, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.location, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.style_tags, '')), lower(:keyword)) > 0
                    or exists (
                        select 1
                        from users u
                        where u.id = d.customer_id
                          and instr(lower(coalesce(u.nickname, '')), lower(:keyword)) > 0
                    )
              )
            order by d.updated_at desc, d.id desc
            """,
            countQuery = """
            select count(*)
            from demands d
            where d.status = 'OPEN'
              and d.moderation_status = 'VISIBLE'
              and coalesce(d.hidden_by_customer, false) = false
              and (:cityCode is null or lower(d.city_code) = lower(:cityCode))
              and (:scene is null or lower(d.scene) = lower(:scene))
              and (:styleTag is null or instr(lower(coalesce(d.style_tags, '')), concat('\"', lower(:styleTag), '\"')) > 0)
              and (:expectedDate is null or d.expected_date = :expectedDate)
              and (:timeTag is null or instr(coalesce(d.time_tags, ''), concat('\"', :timeTag, '\"')) > 0)
              and (
                    (:minBudgetCent is null and :maxBudgetCent is null)
                    or (
                        (d.budget_min_cent is not null or d.budget_max_cent is not null)
                        and (:minBudgetCent is null or coalesce(d.budget_max_cent, d.budget_min_cent) >= :minBudgetCent)
                        and (:maxBudgetCent is null or coalesce(d.budget_min_cent, d.budget_max_cent) <= :maxBudgetCent)
                    )
              )
              and (
                    :keyword is null
                    or instr(lower(coalesce(d.scene, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.description, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.location, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(d.style_tags, '')), lower(:keyword)) > 0
                    or exists (
                        select 1
                        from users u
                        where u.id = d.customer_id
                          and instr(lower(coalesce(u.nickname, '')), lower(:keyword)) > 0
                    )
              )
            """,
            nativeQuery = true)
    Page<Demand> findPublicPage(@Param("cityCode") String cityCode,
                                @Param("scene") String scene,
                                @Param("styleTag") String styleTag,
                                @Param("expectedDate") LocalDate expectedDate,
                                @Param("timeTag") String timeTag,
                                @Param("minBudgetCent") Integer minBudgetCent,
                                @Param("maxBudgetCent") Integer maxBudgetCent,
                                @Param("keyword") String keyword,
                                Pageable pageable);

    long countByModerationStatus(ModerationStatus moderationStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Demand d where d.id = :id")
    Optional<Demand> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select d from Demand d
            where d.customerId = :customerId
              and d.status in :statuses
              and d.hiddenByCustomer = false
            order by d.updatedAt desc, d.id desc
            """)
    List<Demand> findOwnerHistory(@Param("customerId") Long customerId,
                                  @Param("statuses") Collection<DemandStatus> statuses);
}
