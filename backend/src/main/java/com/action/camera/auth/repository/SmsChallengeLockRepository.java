package com.action.camera.auth.repository;
import com.action.camera.auth.domain.SmsChallengeLock;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface SmsChallengeLockRepository extends JpaRepository<SmsChallengeLock,String> {
    @Modifying
    @Query(value="INSERT IGNORE INTO sms_challenge_locks (lock_key) VALUES (:key)", nativeQuery=true)
    void ensure(@Param("key") String key);
    @Query(value="SELECT lock_key FROM sms_challenge_locks WHERE lock_key=:key FOR UPDATE", nativeQuery=true)
    String lock(@Param("key") String key);
}
