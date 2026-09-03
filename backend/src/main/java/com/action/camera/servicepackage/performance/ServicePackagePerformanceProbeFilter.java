package com.action.camera.servicepackage.performance;

import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.UUID;

@Component
@ConditionalOnProperty(
        prefix = "service-package.performance-probe",
        name = "enabled",
        havingValue = "true"
)
public class ServicePackagePerformanceProbeFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(ServicePackagePerformanceProbeFilter.class);
    private static final String RUN_ID_HEADER = "X-Performance-Run-Id";
    private static final String RUN_ID_MDC_KEY = "servicePackagePerformanceRunId";

    private final Statistics statistics;

    public ServicePackagePerformanceProbeFilter(EntityManagerFactory entityManagerFactory) {
        this.statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        this.statistics.setStatisticsEnabled(true);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"GET".equalsIgnoreCase(request.getMethod())
                || !"/service-packages".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String runId = resolveRunId(request);
        String previousRunId = MDC.get(RUN_ID_MDC_KEY);
        MDC.put(RUN_ID_MDC_KEY, runId);
        long sqlCountBefore = statistics.getPrepareStatementCount();
        long requestStartedAt = System.nanoTime();
        boolean completed = false;
        try {
            filterChain.doFilter(request, response);
            completed = true;
        } finally {
            double backendTimeMs = (System.nanoTime() - requestStartedAt) / 1_000_000.0d;
            long sqlCount = Math.max(0L, statistics.getPrepareStatementCount() - sqlCountBefore);
            boolean success = completed && response.getStatus() < 400;
            LOGGER.info(
                    "event=service-package-request runId={} sqlCount={} backendTimeMs={} status={} success={}",
                    runId,
                    sqlCount,
                    String.format(Locale.ROOT, "%.3f", backendTimeMs),
                    response.getStatus(),
                    success
            );
            restoreRunId(previousRunId);
        }
    }

    private String resolveRunId(HttpServletRequest request) {
        String requestedRunId = request.getHeader(RUN_ID_HEADER);
        if (requestedRunId == null || requestedRunId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        return requestedRunId.trim();
    }

    private void restoreRunId(String previousRunId) {
        if (previousRunId == null) {
            MDC.remove(RUN_ID_MDC_KEY);
            return;
        }
        MDC.put(RUN_ID_MDC_KEY, previousRunId);
    }
}
