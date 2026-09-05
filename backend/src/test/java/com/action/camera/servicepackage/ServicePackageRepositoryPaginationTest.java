package com.action.camera.servicepackage;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
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
class ServicePackageRepositoryPaginationTest {

    @Autowired
    private ServicePackageRepository repository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void publicPageFiltersCountsSortsAndPagesInDatabase() {
        LocalDate availableDate = LocalDate.of(2026, 9, 6);
        repository.saveAll(List.of(
                servicePackage(1L, "NJ", 30_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(2L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(3L, "NJ", 50_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(4L, "SH", 60_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(5L, "NJ", 70_000L, availableDate, ModerationStatus.HIDDEN, false),
                servicePackage(6L, "NJ", 80_000L, availableDate, ModerationStatus.VISIBLE, true)
        ));
        repository.flush();

        Page<ServicePackage> page = repository.findPublicPage(
                "nj", "portrait", "natural", 30_000L, 60_000L,
                availableDate.toString(), "NEAR_7_DAYS", null, "price_desc",
                PageRequest.of(1, 1));

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(ServicePackage::getBasePriceCent)
                .containsExactly(40_000L);
    }

    @Test
    void ordinarySortsStayDatabaseOrdered() {
        LocalDate availableDate = LocalDate.of(2026, 9, 6);
        repository.saveAll(List.of(
                servicePackage(11L, "NJ", 30_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(12L, "NJ", 50_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(13L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false)
        ));
        repository.flush();

        assertThat(prices("latest")).containsExactly(40_000L, 50_000L, 30_000L);
        assertThat(prices("price_asc")).containsExactly(30_000L, 40_000L, 50_000L);
        assertThat(prices("price_desc")).containsExactly(50_000L, 40_000L, 30_000L);
        assertThat(prices("created_asc")).containsExactly(30_000L, 50_000L, 40_000L);
    }

    @Test
    void keywordUsesEffectiveProfileNameAndStyleUsesExactJsonMember() {
        LocalDate availableDate = LocalDate.of(2026, 9, 6);
        ServicePackage exactStyle = servicePackage(
                21L, "NJ", 30_000L, availableDate, ModerationStatus.VISIBLE, false);
        ServicePackage substringOnly = servicePackage(
                22L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false);
        substringOnly.setStyleTags(List.of("supernatural"));
        repository.saveAll(List.of(exactStyle, substringOnly));
        repository.flush();
        jdbcTemplate.update("""
                insert into users (id, nickname, current_role, status, created_at, updated_at)
                values (?, ?, 'PROVIDER', 'ACTIVE', current_timestamp, current_timestamp)
                """, 21L, "Fallback Name");
        jdbcTemplate.update("""
                insert into provider_profiles (user_id, display_name)
                values (?, ?)
                """, 21L, "Aurora Studio");

        Page<ServicePackage> byProfileName = repository.findPublicPage(
                null, null, "natural", null, null, null, null,
                "aurora", "latest", PageRequest.of(0, 10));
        Page<ServicePackage> byShadowedUserName = repository.findPublicPage(
                null, null, "natural", null, null, null, null,
                "fallback", "latest", PageRequest.of(0, 10));

        assertThat(byProfileName.getContent()).extracting(ServicePackage::getProviderId)
                .containsExactly(21L);
        assertThat(byProfileName.getTotalElements()).isOne();
        assertThat(byShadowedUserName).isEmpty();
    }

    @Test
    void ordinaryPagesMatchA1GoldenIdSecondarySortForEverySort() {
        LocalDate availableDate = LocalDate.of(2026, 9, 6);
        LocalDateTime tiedTimestamp = LocalDateTime.of(2026, 9, 1, 10, 0);
        List<ServicePackage> tied = List.of(
                servicePackage(31L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(32L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(33L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false),
                servicePackage(34L, "NJ", 40_000L, availableDate, ModerationStatus.VISIBLE, false)
        );
        tied.forEach(servicePackage -> {
            servicePackage.setCreatedAt(tiedTimestamp);
            servicePackage.setUpdatedAt(tiedTimestamp);
        });
        repository.saveAllAndFlush(tied);
        List<Long> ascending = tied.stream().map(ServicePackage::getId).toList();
        List<Long> descending = new ArrayList<>(ascending);
        Collections.reverse(descending);

        assertTwoPages("price_asc", ascending);
        assertTwoPages("created_asc", ascending);
        assertTwoPages("price_desc", descending);
        assertTwoPages("latest", descending);
    }

    @Test
    void filtersMatchA1GoldenContainsAndVisibilitySemantics() {
        LocalDate targetDate = LocalDate.of(2026, 9, 8);
        ServicePackage match = servicePackage(
                41L, "NJ", 30_000L, targetDate, ModerationStatus.VISIBLE, false);
        match.setTitle("中文人像 Alpha");
        match.setDescription("Golden Light");
        match.setServiceArea("Campus North");
        match.setStyleTags(List.of("natural", "街拍"));
        match.setTimeTags(List.of("NEAR_7_DAYS"));

        ServicePackage substringStyle = servicePackage(
                42L, "SH", 40_000L, targetDate.plusDays(1), ModerationStatus.VISIBLE, false);
        substringStyle.setTitle("Other package");
        substringStyle.setScene("WEDDING");
        substringStyle.setServiceArea("Downtown");
        substringStyle.setStyleTags(List.of("supernatural"));
        substringStyle.setTimeTags(List.of("NEAR_3_DAYS"));

        ServicePackage other = servicePackage(
                43L, "BJ", 50_000L, targetDate.plusDays(2), ModerationStatus.VISIBLE, false);
        other.setTitle("Documentary");
        other.setScene("EVENT");
        other.setServiceArea("Studio");
        other.setStyleTags(List.of("documentary"));
        other.setTimeTags(List.of("NEAR_1_MONTH"));

        ServicePackage offline = servicePackage(
                44L, "NJ", 30_000L, targetDate, ModerationStatus.VISIBLE, false);
        offline.setStatus(ServicePackageStatus.OFFLINE);
        ServicePackage moderated = servicePackage(
                45L, "NJ", 30_000L, targetDate, ModerationStatus.HIDDEN, false);
        ServicePackage providerHidden = servicePackage(
                46L, "NJ", 30_000L, targetDate, ModerationStatus.VISIBLE, true);
        repository.saveAllAndFlush(List.of(match, substringStyle, other, offline, moderated, providerHidden));

        assertThat(query(null, null, null, null, null, null, null, null).getTotalElements()).isEqualTo(3);
        assertThat(query(null, null, null, null, null, null, null, "").getTotalElements()).isEqualTo(3);
        assertOnly(match, query(null, null, null, null, null, null, null, "中文"));
        assertOnly(match, query(null, null, null, null, null, null, null, "GOLDEN"));
        assertOnly(match, query(null, null, null, null, null, null, null, "campus"));
        assertOnly(match, query("nj", null, null, null, null, null, null, null));
        assertOnly(match, query(null, "portrait", null, null, null, null, null, null));
        assertOnly(match, query(null, null, "natural", null, null, null, null, null));
        assertOnly(match, query(null, null, "街拍", null, null, null, null, null));
        assertOnly(match, query(null, null, null, 30_000L, 30_000L, null, null, null));
        assertOnly(match, query(null, null, null, null, null, targetDate.toString(), null, null));
        assertOnly(match, query(null, null, null, null, null, null, "NEAR_7_DAYS", null));
    }

    private void assertTwoPages(String sort, List<Long> expected) {
        Page<ServicePackage> page1 = repository.findPublicPage(
                null, null, null, null, null, null, null, null, sort, PageRequest.of(0, 2));
        Page<ServicePackage> page2 = repository.findPublicPage(
                null, null, null, null, null, null, null, null, sort, PageRequest.of(1, 2));

        assertThat(page1.getTotalElements()).isEqualTo(4);
        assertThat(page2.getTotalElements()).isEqualTo(4);
        assertThat(page1.getContent()).extracting(ServicePackage::getId)
                .containsExactlyElementsOf(expected.subList(0, 2));
        assertThat(page2.getContent()).extracting(ServicePackage::getId)
                .containsExactlyElementsOf(expected.subList(2, 4));
    }

    private Page<ServicePackage> query(String city,
                                       String scene,
                                       String style,
                                       Long minPrice,
                                       Long maxPrice,
                                       String availableDate,
                                       String timeTag,
                                       String keyword) {
        return repository.findPublicPage(
                city, scene, style, minPrice, maxPrice, availableDate, timeTag, keyword,
                "latest", PageRequest.of(0, 20));
    }

    private void assertOnly(ServicePackage expected, Page<ServicePackage> actual) {
        assertThat(actual.getTotalElements()).isOne();
        assertThat(actual.getContent()).extracting(ServicePackage::getId).containsExactly(expected.getId());
    }

    private List<Long> prices(String sort) {
        return repository.findPublicPage(
                        null, null, null, null, null, null, null, null, sort,
                        PageRequest.of(0, 10))
                .getContent().stream()
                .map(ServicePackage::getBasePriceCent)
                .toList();
    }

    private ServicePackage servicePackage(Long providerId,
                                          String city,
                                          Long price,
                                          LocalDate availableDate,
                                          ModerationStatus moderationStatus,
                                          boolean hiddenByProvider) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(providerId);
        servicePackage.setTitle("Portrait " + providerId);
        servicePackage.setCityCode(city);
        servicePackage.setServiceArea("Campus");
        servicePackage.setScene("PORTRAIT");
        servicePackage.setStyleTags(List.of("natural"));
        servicePackage.setImages(List.of("cover"));
        servicePackage.setBasePriceCent(price);
        servicePackage.setDurationMinutes(60);
        servicePackage.setOriginalCount(20);
        servicePackage.setRefinedCount(5);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(availableDate));
        servicePackage.setPortfolioIds(List.of());
        servicePackage.setDescription("Natural portrait");
        servicePackage.setTimeDescription("Weekends");
        servicePackage.setTimeTags(List.of("NEAR_7_DAYS"));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);
        servicePackage.setHiddenByProvider(hiddenByProvider);
        servicePackage.setModerationStatus(moderationStatus);
        LocalDateTime timestamp = LocalDateTime.of(2026, 9, 1, 10, 0).plusMinutes(providerId);
        servicePackage.setCreatedAt(timestamp);
        servicePackage.setUpdatedAt(timestamp);
        return servicePackage;
    }
}
