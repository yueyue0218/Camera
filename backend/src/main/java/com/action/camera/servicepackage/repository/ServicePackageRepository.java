package com.action.camera.servicepackage.repository;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ServicePackageRepository extends JpaRepository<ServicePackage, Long> {

    List<ServicePackage> findByStatus(ServicePackageStatus status);

    @Query(value = """
            select sp.*
            from service_packages sp
            where sp.status = 'ONLINE'
              and sp.moderation_status = 'VISIBLE'
              and coalesce(sp.hidden_by_provider, false) = false
              and (:cityCode is null or lower(sp.city_code) = lower(:cityCode))
              and (:scene is null or lower(sp.scene) = lower(:scene))
              and (:style is null or instr(lower(coalesce(sp.style_tags, '')), concat('\"', lower(:style), '\"')) > 0)
              and (:minPriceCent is null or sp.base_price_cent >= :minPriceCent)
              and (:maxPriceCent is null or sp.base_price_cent <= :maxPriceCent)
              and (:availableDate is null or instr(coalesce(sp.available_dates, ''), concat('\"', :availableDate, '\"')) > 0)
              and (:timeTag is null or instr(coalesce(sp.time_tags, ''), concat('\"', :timeTag, '\"')) > 0)
              and (
                    :keyword is null
                    or instr(lower(coalesce(sp.title, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.description, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.service_area, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.scene, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.style_tags, '')), lower(:keyword)) > 0
                    or exists (
                        select 1
                        from users u
                        left join provider_profiles pp on pp.user_id = u.id
                        where u.id = sp.provider_id
                          and instr(
                              lower(coalesce(nullif(trim(pp.display_name), ''), u.nickname, '')),
                              lower(:keyword)
                          ) > 0
                    )
              )
            order by
              case when :sort = 'price_asc' then sp.base_price_cent end asc,
              case when :sort = 'price_asc' then sp.id end asc,
              case when :sort = 'price_desc' then sp.base_price_cent end desc,
              case when :sort = 'price_desc' then sp.id end desc,
              case when :sort = 'created_asc' then sp.created_at end asc,
              case when :sort = 'created_asc' then sp.id end asc,
              case when :sort = 'latest' then sp.updated_at end desc,
              case when :sort = 'latest' then sp.id end desc
            """,
            countQuery = """
            select count(*)
            from service_packages sp
            where sp.status = 'ONLINE'
              and sp.moderation_status = 'VISIBLE'
              and coalesce(sp.hidden_by_provider, false) = false
              and (:cityCode is null or lower(sp.city_code) = lower(:cityCode))
              and (:scene is null or lower(sp.scene) = lower(:scene))
              and (:style is null or instr(lower(coalesce(sp.style_tags, '')), concat('\"', lower(:style), '\"')) > 0)
              and (:minPriceCent is null or sp.base_price_cent >= :minPriceCent)
              and (:maxPriceCent is null or sp.base_price_cent <= :maxPriceCent)
              and (:availableDate is null or instr(coalesce(sp.available_dates, ''), concat('\"', :availableDate, '\"')) > 0)
              and (:timeTag is null or instr(coalesce(sp.time_tags, ''), concat('\"', :timeTag, '\"')) > 0)
              and (
                    :keyword is null
                    or instr(lower(coalesce(sp.title, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.description, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.service_area, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.scene, '')), lower(:keyword)) > 0
                    or instr(lower(coalesce(sp.style_tags, '')), lower(:keyword)) > 0
                    or exists (
                        select 1
                        from users u
                        left join provider_profiles pp on pp.user_id = u.id
                        where u.id = sp.provider_id
                          and instr(
                              lower(coalesce(nullif(trim(pp.display_name), ''), u.nickname, '')),
                              lower(:keyword)
                          ) > 0
                    )
              )
            """,
            nativeQuery = true)
    Page<ServicePackage> findPublicPage(@Param("cityCode") String cityCode,
                                        @Param("scene") String scene,
                                        @Param("style") String style,
                                        @Param("minPriceCent") Long minPriceCent,
                                        @Param("maxPriceCent") Long maxPriceCent,
                                        @Param("availableDate") String availableDate,
                                        @Param("timeTag") String timeTag,
                                        @Param("keyword") String keyword,
                                        @Param("sort") String sort,
                                        Pageable pageable);

    long countByModerationStatus(ModerationStatus moderationStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ServicePackage s where s.id = :id")
    Optional<ServicePackage> findByIdForUpdate(@Param("id") Long id);

    Optional<ServicePackage> findByIdAndProviderId(Long id, Long providerId);

    @Query("""
            select s from ServicePackage s
            where s.providerId = :providerId
              and s.hiddenByProvider = false
            order by s.updatedAt desc, s.id desc
            """)
    List<ServicePackage> findOwnerHistory(@Param("providerId") Long providerId);
}
