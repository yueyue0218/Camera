package com.action.camera.dispute.repository;

import com.action.camera.dispute.entity.DisputeReply;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisputeReplyRepository extends JpaRepository<DisputeReply, Long> {

    List<DisputeReply> findByDisputeIdOrderByCreatedAtAsc(Long disputeId);
}
