package com.action.camera.servicepackage;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.message.service.ConversationService;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletResponse;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServicePackagePerformanceProbeTest {

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private ServicePackageInterestRepository interestRepository;

    @Mock
    private ConversationService conversationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProviderProfileMapper providerProfileMapper;

    @Mock
    private CreditSnapshotService creditSnapshotService;

    private ServicePackageService service;
    private Logger serviceLogger;
    private ListAppender<ILoggingEvent> logAppender;
    private Logger filterLogger;
    private ListAppender<ILoggingEvent> filterLogAppender;

    @BeforeEach
    void setUp() {
        service = new ServicePackageService(
                servicePackageRepository,
                interestRepository,
                conversationService,
                userRepository,
                providerProfileMapper,
                creditSnapshotService
        );
        serviceLogger = (Logger) LoggerFactory.getLogger(ServicePackageService.class);
        logAppender = new ListAppender<>();
        logAppender.start();
        serviceLogger.addAppender(logAppender);
        filterLogger = (Logger) LoggerFactory.getLogger(
                "com.action.camera.servicepackage.performance.ServicePackagePerformanceProbeFilter");
        filterLogAppender = new ListAppender<>();
        filterLogAppender.start();
        filterLogger.addAppender(filterLogAppender);
    }

    @AfterEach
    void tearDown() {
        serviceLogger.detachAppender(logAppender);
        filterLogger.detachAppender(filterLogAppender);
        MDC.clear();
    }

    @Test
    void metadataTimingIsSilentWhenProbeIsDisabledByDefault() {
        arrangeSingleVisiblePackage();

        service.listServices(1, 10, null, null, null, null, null, null, null);

        assertThat(performanceMessages()).isEmpty();
    }

    @Test
    void metadataTimingIsLoggedOnlyWhenProbeIsExplicitlyEnabled() {
        boolean enableFlagExists = Arrays.stream(ServicePackageService.class.getDeclaredFields())
                .anyMatch(field -> field.getName().equals("servicePackagePerformanceProbeEnabled"));
        assertThat(enableFlagExists)
                .as("the explicit service-package performance probe flag must exist")
                .isTrue();

        ReflectionTestUtils.setField(service, "servicePackagePerformanceProbeEnabled", true);
        MDC.put("servicePackagePerformanceRunId", "probe-test");
        arrangeSingleVisiblePackage();

        service.listServices(1, 10, null, null, null, null, null, null, null);

        assertThat(performanceMessages())
                .singleElement()
                .satisfies(message -> {
                    assertThat(message).contains("event=service-package-metadata");
                    assertThat(message).contains("runId=probe-test");
                    assertThat(message).contains("candidateCount=1");
                    assertThat(message).contains("photographerCount=1");
                    assertThat(message).containsPattern("metadataTimeMs=\\d+\\.\\d{3}");
                });
    }

    @Test
    void requestProbeBeanIsDisabledUnlessExplicitlyEnabled() {
        EntityManagerFactory entityManagerFactory = mock(EntityManagerFactory.class);

        new ApplicationContextRunner()
                .withBean(EntityManagerFactory.class, () -> entityManagerFactory)
                .withUserConfiguration(probeType())
                .run(context -> assertThat(context.getBeanNamesForType(probeType())).isEmpty());
    }

    @Test
    void enabledRequestProbeLogsSqlDeltaAndBackendTimeForPublicListOnly() throws Exception {
        EntityManagerFactory entityManagerFactory = mock(EntityManagerFactory.class);
        SessionFactory sessionFactory = mock(SessionFactory.class);
        Statistics statistics = mock(Statistics.class);
        when(entityManagerFactory.unwrap(SessionFactory.class)).thenReturn(sessionFactory);
        when(sessionFactory.getStatistics()).thenReturn(statistics);
        when(statistics.getPrepareStatementCount()).thenReturn(10L, 17L);

        Filter filter = (Filter) probeType()
                .getDeclaredConstructor(EntityManagerFactory.class)
                .newInstance(entityManagerFactory);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/service-packages");
        request.addHeader("X-Performance-Run-Id", "request-test");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                ((HttpServletResponse) servletResponse).setStatus(200));

        assertThat(filterPerformanceMessages())
                .singleElement()
                .satisfies(message -> {
                    assertThat(message).contains("event=service-package-request");
                    assertThat(message).contains("runId=request-test");
                    assertThat(message).contains("sqlCount=7");
                    assertThat(message).contains("status=200");
                    assertThat(message).contains("success=true");
                    assertThat(message).containsPattern("backendTimeMs=\\d+\\.\\d{3}");
                });
        assertThat(MDC.get("servicePackagePerformanceRunId")).isNull();
    }

    @Test
    void enabledRequestProbeIgnoresEveryOtherRoute() throws Exception {
        EntityManagerFactory entityManagerFactory = mock(EntityManagerFactory.class);
        SessionFactory sessionFactory = mock(SessionFactory.class);
        Statistics statistics = mock(Statistics.class);
        when(entityManagerFactory.unwrap(SessionFactory.class)).thenReturn(sessionFactory);
        when(sessionFactory.getStatistics()).thenReturn(statistics);
        Filter filter = (Filter) probeType()
                .getDeclaredConstructor(EntityManagerFactory.class)
                .newInstance(entityManagerFactory);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/demands");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> chainInvoked.set(true));

        assertThat(chainInvoked).isTrue();
        assertThat(filterPerformanceMessages()).isEmpty();
    }

    private void arrangeSingleVisiblePackage() {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setId(1L);
        servicePackage.setProviderId(2L);
        servicePackage.setTitle("Portrait package");
        servicePackage.setCityCode("NJ");
        servicePackage.setScene("PORTRAIT");
        servicePackage.setStyleTags(List.of("natural"));
        servicePackage.setImages(List.of());
        servicePackage.setBasePriceCent(10000L);
        servicePackage.setDurationMinutes(60);
        servicePackage.setOriginalCount(20);
        servicePackage.setRefinedCount(5);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of());
        servicePackage.setPortfolioIds(List.of());
        servicePackage.setTimeDescription("weekends");
        servicePackage.setTimeTags(List.of());
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);
        servicePackage.setCreatedAt(LocalDateTime.of(2026, 9, 1, 10, 0));
        servicePackage.setUpdatedAt(LocalDateTime.of(2026, 9, 1, 10, 0));

        when(servicePackageRepository.findPublicPage(
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(servicePackage)));
        when(userRepository.findAllById(any())).thenReturn(List.of());
    }

    private List<String> performanceMessages() {
        return logAppender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.contains("event=service-package-"))
                .toList();
    }

    private List<String> filterPerformanceMessages() {
        return filterLogAppender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.contains("event=service-package-request"))
                .toList();
    }

    private Class<?> probeType() {
        try {
            return Class.forName(
                    "com.action.camera.servicepackage.performance.ServicePackagePerformanceProbeFilter");
        } catch (ClassNotFoundException exception) {
            fail("the conditional service-package request probe must exist", exception);
            return null;
        }
    }
}
