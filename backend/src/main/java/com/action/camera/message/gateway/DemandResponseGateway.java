package com.action.camera.message.gateway;

import com.action.camera.message.model.AcceptedResponseSnapshot;

import java.util.Optional;

/**
 * Adapter boundary for B module. C consumes snapshots and does not depend on B mappers directly.
 */
public interface DemandResponseGateway {

    Optional<AcceptedResponseSnapshot> findByResponseId(Long responseId);
}
