package com.action.camera.servicepackage;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.action.camera.application.IpLocationService;
import com.action.camera.servicepackage.performance.ServicePackagePerformanceProbeFilter;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "spring.jpa.hibernate.ddl-auto=none",
                "spring.sql.init.mode=never",
                "camera.demo.seed-users=false",
                "service-package.performance-probe.enabled=true",
                "logging.level.com.action.camera.provider.mapper=DEBUG"
        })
@AutoConfigureMockMvc
@EnabledIfSystemProperty(named = "camera.performance.mysql-smoke", matches = "true")
class ServicePackageA2MySqlSmokeTest {

    private static final String RUN_ID = "a2-mysql-smoke";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IpLocationService ipLocationService;

    private Logger serviceLogger;
    private Logger probeLogger;
    private Logger profileMapperLogger;
    private ListAppender<ILoggingEvent> serviceAppender;
    private ListAppender<ILoggingEvent> probeAppender;
    private ListAppender<ILoggingEvent> profileMapperAppender;

    @BeforeEach
    void attachEvidenceAppenders() {
        serviceLogger = (Logger) LoggerFactory.getLogger(ServicePackageService.class);
        probeLogger = (Logger) LoggerFactory.getLogger(ServicePackagePerformanceProbeFilter.class);
        profileMapperLogger = (Logger) LoggerFactory.getLogger("com.action.camera.provider.mapper");
        serviceAppender = appender(serviceLogger);
        probeAppender = appender(probeLogger);
        profileMapperAppender = appender(profileMapperLogger);
    }

    @AfterEach
    void detachEvidenceAppenders() {
        detach(serviceLogger, serviceAppender);
        detach(probeLogger, probeAppender);
        detach(profileMapperLogger, profileMapperAppender);
    }

    @Test
    void sameA1RequestUsesFixedEightSqlStatementsAgainstFrozenMySqlDataset() throws Exception {
        mockMvc.perform(get("/service-packages")
                        .param("page", "1")
                        .param("size", "10")
                        .header("X-Performance-Run-Id", RUN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.total").value(54))
                .andExpect(jsonPath("$.data.records.length()").value(10));

        String requestMetric = messages(probeAppender).stream()
                .filter(message -> message.contains("event=service-package-request"))
                .findFirst()
                .orElseThrow();
        String metadataMetric = messages(serviceAppender).stream()
                .filter(message -> message.contains("event=service-package-metadata"))
                .findFirst()
                .orElseThrow();
        long profileQueries = profileMapperAppender.list.stream()
                .filter(event -> RUN_ID.equals(event.getMDCPropertyMap().get("servicePackagePerformanceRunId")))
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.contains("Preparing:"))
                .count();

        assertThat(requestMetric)
                .contains("runId=" + RUN_ID)
                .contains("sqlCount=7")
                .contains("status=200")
                .contains("success=true");
        assertThat(metadataMetric)
                .contains("runId=" + RUN_ID)
                .contains("candidateCount=10")
                .contains("photographerCount=5");
        assertThat(profileQueries).isOne();
        System.out.printf(
                "A2_SQL_SMOKE runId=%s httpStatus=200 businessCode=200 success=true "
                        + "hibernateSql=7 myBatisSql=1 sqlCount=8 candidateCount=10 photographerCount=5 records=10 total=54%n",
                RUN_ID);
    }

    @Test
    void recommendationUsesFixedSevenSqlStatementsForAllFrozenCandidates() throws Exception {
        String recommendRunId = RUN_ID + "-recommend";
        mockMvc.perform(get("/service-packages")
                        .param("page", "1")
                        .param("size", "10")
                        .param("sort", "recommend")
                        .param("feedSeed", "semantic-seed")
                        .header("X-Performance-Run-Id", recommendRunId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.total").value(54))
                .andExpect(jsonPath("$.data.records.length()").value(10));

        String requestMetric = messages(probeAppender).stream()
                .filter(message -> message.contains("event=service-package-request"))
                .findFirst()
                .orElseThrow();
        String metadataMetric = messages(serviceAppender).stream()
                .filter(message -> message.contains("event=service-package-metadata"))
                .findFirst()
                .orElseThrow();
        long profileQueries = profileMapperAppender.list.stream()
                .filter(event -> recommendRunId.equals(
                        event.getMDCPropertyMap().get("servicePackagePerformanceRunId")))
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.contains("Preparing:"))
                .count();

        assertThat(requestMetric)
                .contains("runId=" + recommendRunId)
                .contains("sqlCount=6")
                .contains("status=200")
                .contains("success=true");
        assertThat(metadataMetric)
                .contains("runId=" + recommendRunId)
                .contains("candidateCount=54")
                .contains("photographerCount=27");
        assertThat(profileQueries).isOne();
        System.out.printf(
                "A2_RECOMMEND_SQL_SMOKE request=/service-packages?page=1&size=10&sort=recommend&feedSeed=semantic-seed "
                        + "httpStatus=200 businessCode=200 success=true hibernateSql=6 myBatisSql=1 sqlCount=7 "
                        + "candidateCount=54 photographerCount=27 records=10 total=54%n");
    }

    private ListAppender<ILoggingEvent> appender(Logger logger) {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    private void detach(Logger logger, ListAppender<ILoggingEvent> appender) {
        if (logger != null && appender != null) {
            logger.detachAppender(appender);
        }
    }

    private List<String> messages(ListAppender<ILoggingEvent> appender) {
        return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }
}
