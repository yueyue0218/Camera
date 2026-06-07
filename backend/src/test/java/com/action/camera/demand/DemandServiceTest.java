package com.action.camera.demand;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandResponseStatus;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.controller.DemandController;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.AcceptedDemandResponseSnapshot;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:demand_service_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class DemandServiceTest {

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private DemandResponseRepository responseRepository;

    @MockBean
    private ConversationService conversationService;

    @Autowired
    private DemandService demandService;

    private final CurrentUser customer = new CurrentUser(1001L, UserRole.CUSTOMER);
    private final CurrentUser otherCustomer = new CurrentUser(1002L, UserRole.CUSTOMER);
    private final CurrentUser provider = new CurrentUser(2001L, UserRole.PROVIDER);
    private final CurrentUser anotherProvider = new CurrentUser(2002L, UserRole.PROVIDER);
    private final CurrentUser thirdProvider = new CurrentUser(2003L, UserRole.PROVIDER);
    private final CurrentUser admin = new CurrentUser(9001L, UserRole.ADMIN);

    @BeforeEach
    void setUp() {
        responseRepository.deleteAll();
        demandRepository.deleteAll();
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(91001L));
    }

    @Test
    void createDemandStoresOpenDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));

        assertThat(demand.getDemandId()).isNotNull();
        assertThat(demand.getStatus()).isEqualTo(DemandStatus.OPEN.name());
        assertThat(demand.getScene()).isEqualTo("GRADUATION");
        assertThat(demand.getCityCode()).isEqualTo("NJU");
    }

    @Test
    void createDemandTrimsSceneCityLocationAndDescription() {
        CreateDemandRequest request = demandRequest("  PORTRAIT  ", "  NJU  ");
        request.setLocation("  南京大学仙林校区  ");
        request.setDescription("  想拍自然光人像  ");

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getScene()).isEqualTo("PORTRAIT");
        assertThat(demand.getCityCode()).isEqualTo("NJU");
        assertThat(demand.getLocation()).isEqualTo("南京大学仙林校区");
        assertThat(demand.getDescription()).isEqualTo("想拍自然光人像");
    }

    @Test
    void createDemandNormalizesStyleTags() {
        CreateDemandRequest request = demandRequest("COSPLAY", "NJU");
        request.setStyleTags(List.of("Fresh", " fresh ", "校园", "", "校园"));

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getStyleTags()).containsExactly("fresh", "校园");
    }

    @Test
    void createDemandAllowsNullStyleTagsAsEmptyList() {
        CreateDemandRequest request = demandRequest("TRAVEL", "NJU");
        request.setStyleTags(null);

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getStyleTags()).isEmpty();
    }

    @Test
    void createDemandAllowsNullBudgets() {
        CreateDemandRequest request = demandRequest("TRAVEL", "NJU");
        request.setBudgetMinCent(null);
        request.setBudgetMaxCent(null);

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getBudgetMinCent()).isNull();
        assertThat(demand.getBudgetMaxCent()).isNull();
    }

    @Test
    void createDemandKeepsReferenceFileIds() {
        CreateDemandRequest request = demandRequest("GRADUATION", "NJU");
        request.setReferenceFileIds(List.of(11L, 12L, 13L));

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getReferenceFileIds()).containsExactly(11L, 12L, 13L);
    }

    @Test
    void createDemandStoresAndReturnsTimeFields() {
        CreateDemandRequest request = demandRequest("GRADUATION", "NJU");
        request.setTimeDescription("July weekends are available");
        request.setTimeTags(List.of("near_7_days", "NEAR_1_MONTH"));

        DemandDto demand = demandService.createDemand(customer, request);

        assertThat(demand.getTimeDescription()).isEqualTo("July weekends are available");
        assertThat(demand.getTimeTags()).containsExactly("NEAR_7_DAYS", "NEAR_1_MONTH");
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getTimeDescription())
                .isEqualTo("July weekends are available");
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getTimeTags())
                .containsExactly("NEAR_7_DAYS", "NEAR_1_MONTH");
    }

    @Test
    void createDemandRejectsMissingTimeDescription() {
        CreateDemandRequest request = demandRequest("GRADUATION", "NJU");
        request.setTimeDescription(" ");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandUsesCustomerIdFromCurrentUser() {
        DemandDto demand = demandService.createDemand(otherCustomer, demandRequest("PORTRAIT", "NJU"));

        assertThat(demand.getCustomerId()).isEqualTo(otherCustomer.getUserId());
    }

    @Test
    void createDemandInitialResponseCountIsZero() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThat(demand.getResponseCount()).isZero();
    }

    @Test
    void createDemandSetsThirtyDayExpiryInRepository() {
        LocalDateTime beforeCreate = LocalDateTime.now();

        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));

        LocalDateTime expireTime = demandRepository.findById(demand.getDemandId()).orElseThrow().getExpireTime();
        Duration distance = Duration.between(beforeCreate.plusDays(30), expireTime).abs();
        assertThat(distance).isLessThan(Duration.ofSeconds(2));
    }

    @Test
    void createDemandRejectsNullRequest() {
        assertThatThrownBy(() -> demandService.createDemand(customer, null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsProviderRole() {
        assertThatThrownBy(() -> demandService.createDemand(provider, demandRequest("PORTRAIT", "NJU")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsBlankScene() {
        CreateDemandRequest request = demandRequest(" ", "NJU");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsBlankCity() {
        CreateDemandRequest request = demandRequest("PORTRAIT", " ");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsBlankLocation() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setLocation(" ");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsNegativeMinBudget() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMinCent(-1);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsNegativeMaxBudget() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMaxCent(-1);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void createDemandRejectsMaxBudgetBelowMin() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMinCent(50000);
        request.setBudgetMaxCent(30000);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void listDemandsReturnsAllWhenNoFilter() {
        demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        demandService.createDemand(customer, demandRequest("COSPLAY", "SH"));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, null, null);

        assertThat(page.getTotal()).isEqualTo(2);
        assertThat(page.getRecords()).hasSize(2);
    }

    @Test
    void listDemandsFiltersByCityIgnoringCase() {
        DemandDto nju = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        demandService.createDemand(customer, demandRequest("GRADUATION", "SH"));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, "nju", null, null);

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).containsExactly(nju.getDemandId());
    }

    @Test
    void listDemandsFiltersBySceneIgnoringCase() {
        DemandDto cosplay = demandService.createDemand(customer, demandRequest("COSPLAY", "NJU"));
        demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, "cosplay", null);

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).containsExactly(cosplay.getDemandId());
    }

    @Test
    void listDemandsFiltersByOpenStatus() {
        DemandDto open = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        acceptOneResponse(demandService.createDemand(customer, demandRequest("TRAVEL", "NJU")));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, null, "OPEN");

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).contains(open.getDemandId());
        assertThat(page.getRecords()).extracting(DemandDto::getStatus).containsOnly(DemandStatus.OPEN.name());
    }

    @Test
    void listDemandsDoesNotExposeClosedStatusInPublicHall() {
        DemandDto closedDemand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(closedDemand.getDemandId(), customer);
        DemandDto openDemand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, null, "CLOSED");
        PageResult<DemandDto> ordinary = demandService.listDemands(1, 10, null, null, null);

        assertThat(page.getRecords()).isEmpty();
        assertThat(ordinary.getRecords()).extracting(DemandDto::getDemandId)
                .contains(openDemand.getDemandId())
                .doesNotContain(closedDemand.getDemandId());
    }

    @Test
    void listMyDemandHistoryReturnsOwnOpenAndClosedDemandsExceptHiddenNewestFirst() throws InterruptedException {
        DemandDto closed = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(closed.getDemandId(), customer);
        Thread.sleep(25);
        DemandDto open = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        Thread.sleep(25);
        DemandDto hidden = demandService.createDemand(customer, demandRequest("COSPLAY", "NJU"));
        demandService.deleteDemand(hidden.getDemandId(), customer);
        demandService.createDemand(otherCustomer, demandRequest("GRADUATION", "NJU"));

        List<DemandDto> history = demandService.listMyDemandHistory(customer);

        assertThat(history).extracting(DemandDto::getDemandId)
                .containsExactly(open.getDemandId(), closed.getDemandId());
        assertThat(history).extracting(DemandDto::getStatus)
                .containsExactly(DemandStatus.OPEN.name(), DemandStatus.CLOSED.name());
    }

    @Test
    void ownerDemandDetailAndHistoryReturnResponseStatusCountsButPublicListDoesNot() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto accepted = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("Accepted response"));
        DemandResponseDto rejected = demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("Rejected response"));
        demandService.respondToDemand(demand.getDemandId(), thirdProvider, responseRequest("Pending response"));

        demandService.acceptResponse(demand.getDemandId(), accepted.getResponseId(), customer);
        demandService.rejectResponse(demand.getDemandId(), rejected.getResponseId(), customer);

        DemandDto ownerDetail = demandService.getDemand(demand.getDemandId(), customer);
        DemandDto historyItem = demandService.listMyDemandHistory(customer).stream()
                .filter(item -> item.getDemandId().equals(demand.getDemandId()))
                .findFirst()
                .orElseThrow();
        DemandDto publicCard = demandService.listDemands(1, 10, null, null, null).getRecords().stream()
                .filter(item -> item.getDemandId().equals(demand.getDemandId()))
                .findFirst()
                .orElseThrow();

        assertThat(ownerDetail.getPendingCount()).isEqualTo(1);
        assertThat(ownerDetail.getAcceptedCount()).isEqualTo(1);
        assertThat(ownerDetail.getRejectedCount()).isEqualTo(1);
        assertThat(historyItem.getPendingCount()).isEqualTo(1);
        assertThat(historyItem.getAcceptedCount()).isEqualTo(1);
        assertThat(historyItem.getRejectedCount()).isEqualTo(1);
        assertThat(publicCard.getPendingCount()).isNull();
        assertThat(publicCard.getAcceptedCount()).isNull();
        assertThat(publicCard.getRejectedCount()).isNull();
    }

    @Test
    void listDemandsFiltersByDateTagAndBudget() {
        LocalDate targetDate = LocalDate.now().plusDays(10);
        CreateDemandRequest targetRequest = demandRequest("PORTRAIT", "NJU");
        targetRequest.setExpectedDate(targetDate);
        targetRequest.setStyleTags(List.of("Fresh", "Campus"));
        targetRequest.setBudgetMinCent(20000);
        targetRequest.setBudgetMaxCent(45000);
        DemandDto target = demandService.createDemand(customer, targetRequest);

        CreateDemandRequest otherRequest = demandRequest("PORTRAIT", "NJU");
        otherRequest.setExpectedDate(targetDate.plusDays(1));
        otherRequest.setStyleTags(List.of("studio"));
        otherRequest.setBudgetMinCent(60000);
        otherRequest.setBudgetMaxCent(90000);
        demandService.createDemand(customer, otherRequest);

        PageResult<DemandDto> page = demandService.listDemands(
                1, 10, "NJU", null, "OPEN", targetDate, "fresh", 30000, 50000);

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).containsExactly(target.getDemandId());
    }

    @Test
    void listDemandsFiltersByTimeTagButOrdinaryListKeepsUntaggedDemand() {
        CreateDemandRequest taggedRequest = demandRequest("PORTRAIT", "NJU");
        taggedRequest.setTimeTags(List.of("NEAR_3_DAYS"));
        DemandDto tagged = demandService.createDemand(customer, taggedRequest);

        CreateDemandRequest untaggedRequest = demandRequest("TRAVEL", "NJU");
        untaggedRequest.setTimeTags(List.of());
        DemandDto untagged = demandService.createDemand(customer, untaggedRequest);

        PageResult<DemandDto> ordinary =
                demandService.listDemands(1, 10, null, null, null);
        PageResult<DemandDto> filtered =
                demandService.listDemands(1, 10, null, null, null, null,
                        null, null, null, "near_3_days");

        assertThat(ordinary.getRecords()).extracting(DemandDto::getDemandId)
                .contains(tagged.getDemandId(), untagged.getDemandId());
        assertThat(filtered.getRecords()).extracting(DemandDto::getDemandId)
                .containsExactly(tagged.getDemandId());
    }

    @Test
    void listDemandsReturnsTimestampsAndSortsByUpdatedAtDescending() throws InterruptedException {
        DemandDto first = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        Thread.sleep(25);
        DemandDto second = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        Thread.sleep(25);

        CreateDemandRequest update = new CreateDemandRequest();
        update.setTimeDescription("Updated availability for this week");
        demandService.updateDemand(first.getDemandId(), customer, update);

        DemandDto refreshedFirst = demandService.getDemand(first.getDemandId(), customer);
        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, null, null);

        assertThat(refreshedFirst.getCreatedAt()).isNotNull();
        assertThat(refreshedFirst.getUpdatedAt()).isAfter(first.getUpdatedAt());
        assertThat(page.getRecords()).extracting(DemandDto::getDemandId)
                .containsExactly(first.getDemandId(), second.getDemandId());
        assertThat(page.getRecords()).allSatisfy(record -> {
            assertThat(record.getCreatedAt()).isNotNull();
            assertThat(record.getUpdatedAt()).isNotNull();
        });
    }

    @Test
    void listDemandsPaginatesFirstPage() {
        createManyDemands(5);

        PageResult<DemandDto> page = demandService.listDemands(1, 2, null, null, null);

        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(2);
        assertThat(page.getTotal()).isEqualTo(5);
        assertThat(page.getRecords()).hasSize(2);
    }

    @Test
    void listDemandsPaginatesSecondPage() {
        createManyDemands(5);

        PageResult<DemandDto> page = demandService.listDemands(2, 2, null, null, null);

        assertThat(page.getPage()).isEqualTo(2);
        assertThat(page.getRecords()).hasSize(2);
    }

    @Test
    void listDemandsReturnsEmptyWhenPageBeyondTotal() {
        createManyDemands(3);

        PageResult<DemandDto> page = demandService.listDemands(9, 10, null, null, null);

        assertThat(page.getRecords()).isEmpty();
        assertThat(page.getTotal()).isEqualTo(3);
    }

    @Test
    void listDemandsCoercesInvalidPageAndSize() {
        createManyDemands(3);

        PageResult<DemandDto> page = demandService.listDemands(0, 0, null, null, null);

        assertThat(page.getPage()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(1);
        assertThat(page.getRecords()).hasSize(1);
    }

    @Test
    void listDemandsCapsPageSizeAtFifty() {
        createManyDemands(55);

        PageResult<DemandDto> page = demandService.listDemands(1, 999, null, null, null);

        assertThat(page.getSize()).isEqualTo(50);
        assertThat(page.getRecords()).hasSize(50);
        assertThat(page.getTotal()).isEqualTo(55);
    }

    @Test
    void getDemandOwnerCanViewOpenDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandDto detail = demandService.getDemand(demand.getDemandId(), customer);

        assertThat(detail.getDemandId()).isEqualTo(demand.getDemandId());
    }

    @Test
    void getDemandProviderCanViewOpenDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandDto detail = demandService.getDemand(demand.getDemandId(), provider);

        assertThat(detail.getStatus()).isEqualTo(DemandStatus.OPEN.name());
    }

    @Test
    void getDemandAdminCanViewOpenDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandDto detail = demandService.getDemand(demand.getDemandId(), admin);

        assertThat(detail.getDemandId()).isEqualTo(demand.getDemandId());
    }

    @Test
    void getDemandOwnerCanViewClosedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(demand.getDemandId(), customer);

        DemandDto detail = demandService.getDemand(demand.getDemandId(), customer);

        assertThat(detail.getStatus()).isEqualTo(DemandStatus.CLOSED.name());
    }

    @Test
    void getDemandAdminCanViewClosedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(demand.getDemandId(), customer);

        DemandDto detail = demandService.getDemand(demand.getDemandId(), admin);

        assertThat(detail.getStatus()).isEqualTo(DemandStatus.CLOSED.name());
    }

    @Test
    void getDemandUnrelatedCustomerCannotViewClosedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(demand.getDemandId(), customer);

        assertThatThrownBy(() -> demandService.getDemand(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void getDemandUnrelatedProviderCannotViewClosedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(demand.getDemandId(), customer);

        assertThatThrownBy(() -> demandService.getDemand(demand.getDemandId(), anotherProvider))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void getDemandRejectsNullDemandId() {
        assertThatThrownBy(() -> demandService.getDemand(null, customer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void getDemandRejectsMissingDemand() {
        assertThatThrownBy(() -> demandService.getDemand(404L, customer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void ownerCanUpdateDemandTimeFields() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandRequest update = new CreateDemandRequest();
        update.setTimeDescription("Only mornings this week");
        update.setTimeTags(List.of("near_3_days", "NEAR_7_DAYS"));

        DemandDto updated = demandService.updateDemand(demand.getDemandId(), customer, update);

        assertThat(updated.getTimeDescription()).isEqualTo("Only mornings this week");
        assertThat(updated.getTimeTags()).containsExactly("NEAR_3_DAYS", "NEAR_7_DAYS");
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getTimeDescription())
                .isEqualTo("Only mornings this week");
    }

    @Test
    void nonOwnerCannotUpdateDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandRequest update = new CreateDemandRequest();
        update.setTimeDescription("Other person edit");

        assertThatThrownBy(() -> demandService.updateDemand(demand.getDemandId(), otherCustomer, update))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void ownerCanCloseOpenDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandDto closed = demandService.closeDemand(demand.getDemandId(), customer);

        assertThat(closed.getStatus()).isEqualTo(DemandStatus.CLOSED.name());
        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.CLOSED);
    }

    @Test
    void nonOwnerCannotCloseDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.closeDemand(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void deleteDemandHidesOwnerHistoryWithoutPhysicalDelete() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        demandService.deleteDemand(demand.getDemandId(), customer);

        Demand saved = demandRepository.findById(demand.getDemandId()).orElseThrow();
        assertThat(saved.getHiddenByCustomer()).isTrue();
        assertThat(saved.getHiddenAt()).isNotNull();
    }

    @Test
    void deleteDemandRejectsNonOwner() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.deleteDemand(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void deleteDemandDoesNotRemoveAcceptedDemandOrResponses() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        demandService.deleteDemand(demand.getDemandId(), customer);

        assertThat(demandRepository.findById(demand.getDemandId())).isPresent();
        assertThat(responseRepository.findByDemandId(demand.getDemandId())).isNotEmpty();
    }

    @Test
    void respondToDemandCreatesPendingResponse() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我可以拍自然抓拍风格"));

        assertThat(response.getStatus()).isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT.name());
        assertThat(response.getDemandId()).isEqualTo(demand.getDemandId());
    }

    @Test
    void respondToDemandStoresMessagePriceAndProviderProfile() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("报价包含 6 张精修"));

        assertThat(response.getMessage()).isEqualTo("报价包含 6 张精修");
        assertThat(response.getExpectedPriceCent()).isEqualTo(39900);
        assertThat(response.getProviderProfileId()).isEqualTo(9001L);
    }

    @Test
    void respondToDemandDefaultsProviderProfileIdToProviderId() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest("未建主页时临时用 userId");
        request.setProviderProfileId(null);

        DemandResponseDto response = demandService.respondToDemand(demand.getDemandId(), provider, request);

        assertThat(response.getProviderProfileId()).isEqualTo(provider.getUserId());
    }

    @Test
    void respondToDemandIncreasesResponseCount() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("第一位服务方"));
        demandService.respondToDemand(demand.getDemandId(), anotherProvider, responseRequest("第二位服务方"));

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getResponseCount()).isEqualTo(2);
    }

    @Test
    void respondToDemandListsResponsesNewestFirst() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        DemandResponseDto first = demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("第一条"));
        DemandResponseDto second = demandService.respondToDemand(demand.getDemandId(), anotherProvider, responseRequest("第二条"));

        List<DemandResponseDto> responses = demandService.listResponses(demand.getDemandId(), customer);

        assertThat(responses).extracting(DemandResponseDto::getResponseId)
                .containsExactly(second.getResponseId(), first.getResponseId());
    }

    @Test
    void respondToDemandRejectsDuplicateProvider() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("第一次响应"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("重复响应")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsCustomerRole() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), customer, responseRequest("客户不能响应")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsAdminRole() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), admin, responseRequest("管理员不接单")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsProviderRespondingToOwnDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CurrentUser samePersonAsProvider = new CurrentUser(customer.getUserId(), UserRole.PROVIDER);

        assertThatThrownBy(() -> demandService.respondToDemand(
                demand.getDemandId(), samePersonAsProvider, responseRequest("自己不能响应自己")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandAllowsAnotherProviderAfterAcceptedResponse() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("Another provider can still respond"));

        assertThat(response.getStatus()).isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT.name());
    }

    @Test
    void respondToDemandRejectsClosedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        demandService.closeDemand(demand.getDemandId(), customer);

        assertThatThrownBy(() -> demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("Closed demand cannot be responded")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsNullRequest() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, null))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsBlankMessage() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest(" ");

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandRejectsNegativePrice() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest("价格非法");
        request.setExpectedPriceCent(-1);

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, request))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void respondToDemandAllowsNullPrice() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest("先沟通后报价");
        request.setExpectedPriceCent(null);

        DemandResponseDto response = demandService.respondToDemand(demand.getDemandId(), provider, request);

        assertThat(response.getExpectedPriceCent()).isNull();
    }

    @Test
    void listResponsesAllowsOwner() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("服务方响应"));

        List<DemandResponseDto> responses = demandService.listResponses(demand.getDemandId(), customer);

        assertThat(responses).hasSize(1);
    }

    @Test
    void listResponsesAllowsAdmin() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        demandService.respondToDemand(demand.getDemandId(), provider, responseRequest("服务方响应"));

        List<DemandResponseDto> responses = demandService.listResponses(demand.getDemandId(), admin);

        assertThat(responses).hasSize(1);
    }

    @Test
    void listResponsesRejectsUnrelatedCustomer() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.listResponses(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void acceptResponseReturnsCContractSnapshot() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("毕业照可以拍，含 6 张精修"));

        AcceptDemandResponseResult result = demandService.acceptResponse(
                demand.getDemandId(), response.getResponseId(), customer);

        assertThat(result.getResponseId()).isEqualTo(response.getResponseId());
        assertThat(result.getDemandId()).isEqualTo(demand.getDemandId());
        assertThat(result.getCustomerId()).isEqualTo(customer.getUserId());
        assertThat(result.getProviderId()).isEqualTo(provider.getUserId());
        assertThat(result.getResponseStatus()).isEqualTo(DemandResponseStatus.ACCEPTED.name());
        assertThat(result.getConversationSourceType()).isEqualTo("DEMAND_RESPONSE");
        assertThat(result.getSourceId()).isEqualTo(response.getResponseId());
        assertThat(result.getConversationId()).isEqualTo(91001L);

        ArgumentCaptor<CreateConversationCommand> commandCaptor =
                ArgumentCaptor.forClass(CreateConversationCommand.class);
        verify(conversationService).createConversationWithInitialMessage(commandCaptor.capture());
        CreateConversationCommand command = commandCaptor.getValue();
        assertThat(command.getCustomerId()).isEqualTo(customer.getUserId());
        assertThat(command.getProviderId()).isEqualTo(provider.getUserId());
        assertThat(command.getInitiatorId()).isEqualTo(customer.getUserId());
        assertThat(command.getSourceType()).isEqualTo("DEMAND_RESPONSE");
        assertThat(command.getSourceId()).isEqualTo(response.getResponseId());
        assertThat(command.getInitialMessage()).isNotBlank();
    }

    @Test
    void acceptResponseKeepsDemandOpenAndMarksResponseAccepted() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我来接"));

        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.OPEN);
        assertThat(responseRepository.findById(response.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
    }

    @Test
    void acceptResponseDoesNotRejectOtherPendingResponses() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto accepted = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("第一位服务方"));
        DemandResponseDto rejected = demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("第二位服务方"));

        demandService.acceptResponse(demand.getDemandId(), accepted.getResponseId(), customer);

        assertThat(responseRepository.findById(rejected.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT);
    }

    @Test
    void acceptResponseAllowsMultipleAcceptedResponsesForSameDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto first = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("First provider"));
        DemandResponseDto second = demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("Second provider"));

        demandService.acceptResponse(demand.getDemandId(), first.getResponseId(), customer);
        demandService.acceptResponse(demand.getDemandId(), second.getResponseId(), customer);

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.OPEN);
        assertThat(responseRepository.findById(first.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
        assertThat(responseRepository.findById(second.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
    }

    @Test
    void rejectResponseMarksPendingResponseRejectedWithoutConversation() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("Provider response"));

        DemandResponseDto rejected = demandService.rejectResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThat(rejected.getStatus()).isEqualTo(DemandResponseStatus.REJECTED.name());
        assertThat(responseRepository.findById(response.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.REJECTED);
        verify(conversationService, never()).createConversationWithInitialMessage(any());
    }

    @Test
    void rejectResponseRejectsAcceptedResponse() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("Provider response"));
        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThatThrownBy(() -> demandService.rejectResponse(demand.getDemandId(), response.getResponseId(), customer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void listMyResponsesShowsProviderResponseStatusChanges() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("Provider response"));
        demandService.rejectResponse(demand.getDemandId(), response.getResponseId(), customer);

        List<DemandResponseDto> responses = demandService.listMyResponses(provider);

        assertThat(responses).extracting(DemandResponseDto::getResponseId).contains(response.getResponseId());
        assertThat(responses).extracting(DemandResponseDto::getStatus).contains(DemandResponseStatus.REJECTED.name());
    }

    @Test
    void listMyResponsesShowsAcceptedStatusAfterOwnerAccepts() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("Provider response"));
        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        List<DemandResponseDto> responses = demandService.listMyResponses(provider);

        assertThat(responses).extracting(DemandResponseDto::getResponseId).contains(response.getResponseId());
        assertThat(responses).extracting(DemandResponseDto::getStatus).contains(DemandResponseStatus.ACCEPTED.name());
    }

    @Test
    void acceptResponseRejectsAlreadyAcceptedResponse() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我来接"));

        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThatThrownBy(() -> demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void acceptResponseRejectsNonOwnerCustomer() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("旅行跟拍我熟"));

        assertThatThrownBy(() -> demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), otherCustomer))
                .isInstanceOf(BusinessException.class);
        assertThat(responseRepository.findById(response.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT);
    }

    @Test
    void getAcceptedSnapshotAllowsProviderAfterAccept() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我来接"));
        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        AcceptedDemandResponseSnapshot snapshot = demandService.getAcceptedSnapshot(response.getResponseId(), provider);

        assertThat(snapshot.getCustomerId()).isEqualTo(customer.getUserId());
        assertThat(snapshot.getProviderId()).isEqualTo(provider.getUserId());
        assertThat(snapshot.getResponseStatus()).isEqualTo(DemandResponseStatus.ACCEPTED.name());
    }

    @Test
    void getAcceptedSnapshotRejectsBeforeAccept() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("还未接受"));

        assertThatThrownBy(() -> demandService.getAcceptedSnapshot(response.getResponseId(), provider))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void demandControllerNoLongerExposesInvitationEndpoints() {
        List<String> methodNames = Arrays.stream(DemandController.class.getDeclaredMethods())
                .map(java.lang.reflect.Method::getName)
                .toList();

        assertThat(methodNames).doesNotContain(
                "createInvitation",
                "listReceivedInvitations",
                "listSentInvitations",
                "acceptInvitation",
                "rejectInvitation"
        );
    }

    private AcceptDemandResponseResult acceptOneResponse(DemandDto demand) {
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我可以接这组需求"));
        return demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);
    }

    private void createManyDemands(int count) {
        for (int i = 0; i < count; i++) {
            demandService.createDemand(customer, demandRequest("SCENE_" + i, "NJU"));
        }
    }

    private CreateDemandRequest demandRequest(String scene, String cityCode) {
        CreateDemandRequest request = new CreateDemandRequest();
        request.setScene(scene);
        request.setCityCode(cityCode);
        request.setLocation("南京大学鼓楼校区");
        request.setExpectedDate(LocalDate.now().plusDays(7));
        request.setTimeSlot("14:00-16:00");
        request.setTimeDescription("Next week afternoons are available");
        request.setTimeTags(List.of("NEAR_7_DAYS"));
        request.setBudgetMinCent(19900);
        request.setBudgetMaxCent(39900);
        request.setStyleTags(List.of("自然抓拍", "校园"));
        request.setDescription("想拍一组轻松自然的校园约拍。");
        return request;
    }

    private CreateDemandResponseRequest responseRequest(String message) {
        CreateDemandResponseRequest request = new CreateDemandResponseRequest();
        request.setProviderProfileId(9001L);
        request.setMessage(message);
        request.setExpectedPriceCent(39900);
        return request;
    }
}
