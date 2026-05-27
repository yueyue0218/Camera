package com.action.camera.demand.repository;

import com.action.camera.demand.domain.DemandResponse;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Repository
public class InMemoryDemandResponseRepository implements DemandResponseRepository {

    private final AtomicLong idGenerator = new AtomicLong(3000);
    private final ConcurrentMap<Long, DemandResponse> data = new ConcurrentHashMap<>();

    @Override
    public Long nextId() {
        return idGenerator.incrementAndGet();
    }

    @Override
    public DemandResponse save(DemandResponse response) {
        data.put(response.getId(), response);
        return response;
    }

    @Override
    public Optional<DemandResponse> findById(Long id) {
        return Optional.ofNullable(data.get(id));
    }

    @Override
    public List<DemandResponse> findByDemandId(Long demandId) {
        return data.values().stream()
                .filter(response -> response.getDemandId().equals(demandId))
                .sorted(Comparator.comparing(DemandResponse::getResponseTime).reversed()
                        .thenComparing(Comparator.comparing(DemandResponse::getId).reversed()))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    @Override
    public Optional<DemandResponse> findByDemandIdAndProviderId(Long demandId, Long providerId) {
        return data.values().stream()
                .filter(response -> response.getDemandId().equals(demandId))
                .filter(response -> response.getProviderId().equals(providerId))
                .findFirst();
    }
}
