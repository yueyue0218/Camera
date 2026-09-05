package com.action.camera.demand;

import com.action.camera.application.IpLocationService;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:demand_a4_sql_smoke;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.show-sql=false"
})
class DemandA4SqlSmokeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @MockBean
    private IpLocationService ipLocationService;

    private Statistics statistics;

    @BeforeEach
    void setUp() {
        demandRepository.deleteAll();
        userRepository.deleteAll();
        LocalDateTime baseTime = LocalDateTime.of(2026, 9, 4, 12, 0);
        for (int index = 1; index <= 23; index++) {
            User user = new User();
            user.setStudentNo(String.format("D4%07d", index));
            user.setPasswordHash("not-used");
            user.setNickname("Demand publisher " + index);
            user.setCurrentRole("CUSTOMER");
            user.setStatus("ACTIVE");
            user = userRepository.saveAndFlush(user);

            Demand demand = new Demand(
                    user.getId(),
                    "PORTRAIT",
                    List.of("fresh-" + index),
                    LocalDate.of(2026, 10, 1),
                    "AFTERNOON",
                    "A4 smoke",
                    List.of("NEAR_1_MONTH"),
                    "CITY-" + index,
                    "Nanjing",
                    20_000,
                    50_000,
                    "Stable HTTP smoke demand " + index,
                    List.of(1L),
                    baseTime.plusMinutes(index),
                    baseTime.plusDays(30));
            demandRepository.saveAndFlush(demand);
        }
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
    }

    @Test
    void latestHttpRequestUsesFixedThreeSqlStatements() throws Exception {
        long startedAt = System.nanoTime();
        mockMvc.perform(get("/demands").param("page", "1").param("size", "23"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(23))
                .andExpect(jsonPath("$.data.total").value(23))
                .andExpect(jsonPath("$.data.records.length()").value(23));
        double totalTimeMs = (System.nanoTime() - startedAt) / 1_000_000.0d;

        long sqlCount = statistics.getPrepareStatementCount();
        assertThat(sqlCount).isEqualTo(3);
        System.out.printf(
                "A4_AFTER request=/demands?page=1&size=23 http=200 businessCode=200 success=true "
                        + "records=23 total=23 sql=3 demandPageAndCount=2 userBatch=1 other=0 totalMs=%.3f%n",
                totalTimeMs);
    }

    @Test
    void recommendHttpRequestKeepsFullCandidateSemanticsWithTwoFixedSqlStatements() throws Exception {
        mockMvc.perform(get("/demands")
                        .param("page", "1")
                        .param("size", "10")
                        .param("sort", "recommend")
                        .param("feedSeed", "demand-seed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.total").value(23))
                .andExpect(jsonPath("$.data.records.length()").value(10));

        long sqlCount = statistics.getPrepareStatementCount();
        assertThat(sqlCount).isEqualTo(2);
        System.out.println(
                "A4_RECOMMEND_AFTER request=/demands?page=1&size=10&sort=recommend&feedSeed=demand-seed "
                        + "http=200 businessCode=200 success=true records=10 total=23 candidates=23 "
                        + "sql=2 demandCandidates=1 userBatch=1 other=0");
    }
}
