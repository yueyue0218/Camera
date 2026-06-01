package com.action.camera.schedule.repository;

import com.action.camera.schedule.entity.Schedule;
import com.action.camera.schedule.enums.ScheduleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByProviderUserIdOrderByStartTimeAsc(Long providerUserId);

    Optional<Schedule> findFirstByProviderUserIdAndStatusAndStartTimeLessThanEqualAndEndTimeGreaterThanEqualOrderByStartTimeAsc(
            Long providerUserId,
            ScheduleStatus status,
            LocalDateTime startTime,
            LocalDateTime endTime);

    List<Schedule> findByLockedByOrderIdAndStatus(Long lockedByOrderId, ScheduleStatus status);

    @Query("""
            select s from Schedule s
            where s.providerUserId = :providerUserId
              and s.status = :status
              and s.endTime > :startTime
              and s.startTime < :endTime
              and (:excludeScheduleId is null or s.id <> :excludeScheduleId)
            order by s.startTime asc
            """)
    List<Schedule> findOverlappingSchedules(@Param("providerUserId") Long providerUserId,
                                            @Param("status") ScheduleStatus status,
                                            @Param("startTime") LocalDateTime startTime,
                                            @Param("endTime") LocalDateTime endTime,
                                            @Param("excludeScheduleId") Long excludeScheduleId);

    @Query("""
            select s from Schedule s
            where s.providerUserId = :providerUserId
              and s.status = com.action.camera.schedule.enums.ScheduleStatus.AVAILABLE
              and s.startTime >= :startTime
              and s.startTime < :endTime
              and (:cityCode is null or s.cityCode = :cityCode)
            order by s.startTime asc
            """)
    List<Schedule> findPublicAvailableSchedules(@Param("providerUserId") Long providerUserId,
                                                @Param("cityCode") String cityCode,
                                                @Param("startTime") LocalDateTime startTime,
                                                @Param("endTime") LocalDateTime endTime);
}
