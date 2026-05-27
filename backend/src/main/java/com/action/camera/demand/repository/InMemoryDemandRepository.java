package com.action.camera.demand.repository;

import com.action.camera.demand.domain.Demand;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class InMemoryDemandRepository implements DemandRepository {

    private final AtomicLong idGenerator = new AtomicLong(5000);
    private final ConcurrentMap<Long, Demand> data = new ConcurrentHashMap<>();

    @Override
    public Long nextId() {
        return idGenerator.incrementAndGet();
    }

    @Override
    public Demand save(Demand demand) {
        data.put(demand.getId(), demand);
        return demand;
    }

    @Override
    public Optional<Demand> findById(Long id) {
        return Optional.ofNullable(data.get(id));
    }

    @Override
    public List<Demand> findAll() {
        return new ArrayList<>(data.values());
    }

    @Override
    public void deleteById(Long id) {
        data.remove(id);
    }
}
