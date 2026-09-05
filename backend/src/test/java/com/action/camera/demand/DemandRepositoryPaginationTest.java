package com.action.camera.demand;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = "spring.jpa.defer-datasource-initialization=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class DemandRepositoryPaginationTest {

    @Autowired
    private DemandRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void publicPageFiltersCountsAndPagesInDatabase() {
        LocalDate targetDate = LocalDate.of(2026, 10, 1);
        Demand first = demand(101L, "NJ", "PORTRAIT", 20_000, 40_000, targetDate);
        Demand second = demand(102L, "NJ", "PORTRAIT", 30_000, 50_000, targetDate);
        Demand third = demand(103L, "NJ", "PORTRAIT", 40_000, 60_000, targetDate);
        Demand otherCity = demand(104L, "SH", "PORTRAIT", 30_000, 50_000, targetDate);
        Demand moderated = demand(105L, "NJ", "PORTRAIT", 30_000, 50_000, targetDate);
        moderated.setModerationStatus(ModerationStatus.HIDDEN);
        Demand customerHidden = demand(106L, "NJ", "PORTRAIT", 30_000, 50_000, targetDate);
        customerHidden.setHiddenByCustomer(true);
        Demand closed = demand(107L, "NJ", "PORTRAIT", 30_000, 50_000, targetDate);
        closed.setStatus(DemandStatus.CLOSED);
        repository.saveAllAndFlush(List.of(first, second, third, otherCity, moderated, customerHidden, closed));

        Page<Demand> page = repository.findPublicPage(
                "nj", "portrait", "fresh", targetDate, "WEEKEND",
                25_000, 55_000, "generic", PageRequest.of(1, 1));

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(Demand::getId).containsExactly(second.getId());
    }

    @Test
    void latestPagesKeepUpdatedAtThenIdDescending() {
        LocalDateTime tied = LocalDateTime.of(2026, 9, 1, 10, 0);
        List<Demand> demands = List.of(
                demand(201L, "NJ", "PORTRAIT", 20_000, 40_000, null),
                demand(202L, "NJ", "PORTRAIT", 20_000, 40_000, null),
                demand(203L, "NJ", "PORTRAIT", 20_000, 40_000, null),
                demand(204L, "NJ", "PORTRAIT", 20_000, 40_000, null));
        demands.forEach(demand -> {
            demand.setCreatedAt(tied);
            demand.setUpdatedAt(tied);
        });
        repository.saveAllAndFlush(demands);
        List<Long> expected = new ArrayList<>(demands.stream().map(Demand::getId).toList());
        Collections.reverse(expected);

        Page<Demand> page1 = query(PageRequest.of(0, 2));
        Page<Demand> page2 = query(PageRequest.of(1, 2));

        assertThat(page1.getTotalElements()).isEqualTo(4);
        assertThat(page2.getTotalElements()).isEqualTo(4);
        assertThat(page1.getContent()).extracting(Demand::getId).containsExactlyElementsOf(expected.subList(0, 2));
        assertThat(page2.getContent()).extracting(Demand::getId).containsExactlyElementsOf(expected.subList(2, 4));
    }

    @Test
    void filtersPreserveNullEmptyChineseCaseJsonAndBudgetOverlapSemantics() {
        LocalDate targetDate = LocalDate.of(2026, 10, 1);
        Demand match = demand(301L, "NJ", "PORTRAIT", null, 40_000, targetDate);
        match.setDescription("中文自然光 Stable");
        match.setLocation("Campus North");
        match.setStyleTags(List.of("fresh", "街拍"));
        match.setTimeTags(List.of("WEEKEND"));
        Demand substringStyle = demand(302L, "NJ", "PORTRAIT", 60_000, null, targetDate);
        substringStyle.setStyleTags(List.of("refresh"));
        Demand noBudget = demand(303L, "NJ", "PORTRAIT", null, null, targetDate);
        noBudget.setStyleTags(List.of("documentary"));
        repository.saveAllAndFlush(List.of(match, substringStyle, noBudget));

        assertThat(query(PageRequest.of(0, 10)).getTotalElements()).isEqualTo(3);
        assertOnly(match, query(null, null, null, null, null, null, null, "中文"));
        assertOnly(match, query(null, null, null, null, null, null, null, "STABLE"));
        assertOnly(match, query(null, null, "街拍", null, null, null, null, null));
        assertThat(query(null, null, "fresh", null, null, null, null, null).getContent())
                .extracting(Demand::getId).containsExactly(match.getId());
        assertOnly(match, query(null, null, null, null, null, 35_000, 45_000, null));
        assertThat(query(null, null, null, null, null, 70_000, null, null)).isEmpty();
    }

    @Test
    void keywordMatchesCustomerNicknameAndMissingCustomerRemainsNullableWithoutKeyword() {
        jdbcTemplate.update("""
                insert into users (id, nickname, current_role, status, created_at, updated_at)
                values (?, ?, 'CUSTOMER', 'ACTIVE', current_timestamp, current_timestamp)
                """, 401L, "南京小雨");
        Demand namedCustomer = demand(401L, "NJ", "PORTRAIT", 20_000, 40_000, null);
        Demand missingCustomer = demand(499L, "SH", "TRAVEL", 20_000, 40_000, null);
        repository.saveAllAndFlush(List.of(namedCustomer, missingCustomer));

        Page<Demand> byNickname = query(null, null, null, null, null, null, null, "小雨");
        Page<Demand> withoutKeyword = query(PageRequest.of(0, 10));

        assertOnly(namedCustomer, byNickname);
        assertThat(withoutKeyword.getTotalElements()).isEqualTo(2);
        assertThat(withoutKeyword.getContent()).extracting(Demand::getId)
                .containsExactly(missingCustomer.getId(), namedCustomer.getId());
    }

    private Page<Demand> query(PageRequest page) {
        return query(null, null, null, null, null, null, null, null, page);
    }

    private Page<Demand> query(String city,
                               String scene,
                               String style,
                               LocalDate expectedDate,
                               String timeTag,
                               Integer minBudget,
                               Integer maxBudget,
                               String keyword) {
        return query(city, scene, style, expectedDate, timeTag, minBudget, maxBudget, keyword, PageRequest.of(0, 20));
    }

    private Page<Demand> query(String city,
                               String scene,
                               String style,
                               LocalDate expectedDate,
                               String timeTag,
                               Integer minBudget,
                               Integer maxBudget,
                               String keyword,
                               PageRequest page) {
        return repository.findPublicPage(
                city, scene, style, expectedDate, timeTag, minBudget, maxBudget, keyword, page);
    }

    private void assertOnly(Demand expected, Page<Demand> actual) {
        assertThat(actual.getTotalElements()).isOne();
        assertThat(actual.getContent()).extracting(Demand::getId).containsExactly(expected.getId());
    }

    private Demand demand(Long customerId,
                          String city,
                          String scene,
                          Integer minBudget,
                          Integer maxBudget,
                          LocalDate expectedDate) {
        LocalDateTime timestamp = LocalDateTime.of(2026, 9, 1, 10, 0).plusMinutes(customerId);
        return new Demand(
                customerId,
                scene,
                List.of("fresh"),
                expectedDate,
                "AFTERNOON",
                "Weekend availability",
                List.of("WEEKEND"),
                city,
                "Campus",
                minBudget,
                maxBudget,
                "Generic demand",
                List.of(1L),
                timestamp,
                timestamp.plusDays(30));
    }
}
