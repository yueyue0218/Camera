package com.action.camera.demand;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.DemandResponseStatus;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.AcceptedDemandResponseSnapshot;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.repository.InMemoryDemandRepository;
import com.action.camera.demand.repository.InMemoryDemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DemandServiceTest {

    private InMemoryDemandRepository demandRepository;
    private InMemoryDemandResponseRepository responseRepository;
    private DemandService demandService;

    private final CurrentUser customer = new CurrentUser(1001L, UserRole.CUSTOMER);
    private final CurrentUser otherCustomer = new CurrentUser(1002L, UserRole.CUSTOMER);
    private final CurrentUser provider = new CurrentUser(2001L, UserRole.PROVIDER);
    private final CurrentUser anotherProvider = new CurrentUser(2002L, UserRole.PROVIDER);
    private final CurrentUser admin = new CurrentUser(9001L, UserRole.ADMIN);

    @BeforeEach
    void setUp() {
        demandRepository = new InMemoryDemandRepository();
        responseRepository = new InMemoryDemandResponseRepository();
        demandService = new DemandService(demandRepository, responseRepository);
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
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("请求体不能为空");
    }

    @Test
    void createDemandRejectsProviderRole() {
        assertThatThrownBy(() -> demandService.createDemand(provider, demandRequest("PORTRAIT", "NJU")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("需求方身份");
    }

    @Test
    void createDemandRejectsBlankScene() {
        CreateDemandRequest request = demandRequest(" ", "NJU");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("拍摄场景不能为空");
    }

    @Test
    void createDemandRejectsBlankCity() {
        CreateDemandRequest request = demandRequest("PORTRAIT", " ");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("城市不能为空");
    }

    @Test
    void createDemandRejectsBlankLocation() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setLocation(" ");

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("拍摄地点不能为空");
    }

    @Test
    void createDemandRejectsNegativeMinBudget() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMinCent(-1);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("最低预算不能为负数");
    }

    @Test
    void createDemandRejectsNegativeMaxBudget() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMaxCent(-1);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("最高预算不能为负数");
    }

    @Test
    void createDemandRejectsMaxBudgetBelowMin() {
        CreateDemandRequest request = demandRequest("PORTRAIT", "NJU");
        request.setBudgetMinCent(50000);
        request.setBudgetMaxCent(30000);

        assertThatThrownBy(() -> demandService.createDemand(customer, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("最高预算不能低于最低预算");
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
    void listDemandsFiltersByMatchedStatus() {
        DemandDto matchedDemand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(matchedDemand);
        demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        PageResult<DemandDto> page = demandService.listDemands(1, 10, null, null, "MATCHED");

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).containsExactly(matchedDemand.getDemandId());
    }

    @Test
    void listDemandsFiltersByDateTagAndBudget() {
        LocalDate targetDate = LocalDate.now().plusDays(10);
        CreateDemandRequest matchedRequest = demandRequest("PORTRAIT", "NJU");
        matchedRequest.setExpectedDate(targetDate);
        matchedRequest.setStyleTags(List.of("Fresh", "Campus"));
        matchedRequest.setBudgetMinCent(20000);
        matchedRequest.setBudgetMaxCent(45000);
        DemandDto matched = demandService.createDemand(customer, matchedRequest);

        CreateDemandRequest otherRequest = demandRequest("PORTRAIT", "NJU");
        otherRequest.setExpectedDate(targetDate.plusDays(1));
        otherRequest.setStyleTags(List.of("studio"));
        otherRequest.setBudgetMinCent(60000);
        otherRequest.setBudgetMaxCent(90000);
        demandService.createDemand(customer, otherRequest);

        PageResult<DemandDto> page = demandService.listDemands(
                1, 10, "NJU", null, "OPEN", targetDate, "fresh", 30000, 50000);

        assertThat(page.getRecords()).extracting(DemandDto::getDemandId).containsExactly(matched.getDemandId());
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
    void getDemandOwnerCanViewMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        DemandDto detail = demandService.getDemand(demand.getDemandId(), customer);

        assertThat(detail.getStatus()).isEqualTo(DemandStatus.MATCHED.name());
    }

    @Test
    void getDemandAdminCanViewMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        DemandDto detail = demandService.getDemand(demand.getDemandId(), admin);

        assertThat(detail.getStatus()).isEqualTo(DemandStatus.MATCHED.name());
    }

    @Test
    void getDemandUnrelatedCustomerCannotViewMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        assertThatThrownBy(() -> demandService.getDemand(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("无权限");
    }

    @Test
    void getDemandUnrelatedProviderCannotViewMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        assertThatThrownBy(() -> demandService.getDemand(demand.getDemandId(), anotherProvider))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("无权限");
    }

    @Test
    void getDemandRejectsNullDemandId() {
        assertThatThrownBy(() -> demandService.getDemand(null, customer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("demandId 不能为空");
    }

    @Test
    void getDemandRejectsMissingDemand() {
        assertThatThrownBy(() -> demandService.getDemand(404L, customer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("需求不存在");
    }

    @Test
    void deleteDemandAllowsOwnerWhenTransactionNotInProgress() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        demandService.deleteDemand(demand.getDemandId(), customer);

        assertThatThrownBy(() -> demandService.getDemand(demand.getDemandId(), customer))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void deleteDemandRejectsNonOwner() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.deleteDemand(demand.getDemandId(), otherCustomer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("only the demand owner");
    }

    @Test
    void deleteDemandRejectsMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        assertThatThrownBy(() -> demandService.deleteDemand(demand.getDemandId(), customer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("transaction in progress");
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
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("重复响应");
    }

    @Test
    void respondToDemandRejectsCustomerRole() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), customer, responseRequest("客户不能响应")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("服务方身份");
    }

    @Test
    void respondToDemandRejectsAdminRole() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), admin, responseRequest("管理员不接单")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("服务方身份");
    }

    @Test
    void respondToDemandRejectsProviderRespondingToOwnDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CurrentUser samePersonAsProvider = new CurrentUser(customer.getUserId(), UserRole.PROVIDER);

        assertThatThrownBy(() -> demandService.respondToDemand(
                demand.getDemandId(), samePersonAsProvider, responseRequest("自己不能响应自己")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不能响应自己发布的需求");
    }

    @Test
    void respondToDemandRejectsMatchedDemand() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        acceptOneResponse(demand);

        assertThatThrownBy(() -> demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("匹配后不能再响应")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("开放中的需求");
    }

    @Test
    void respondToDemandRejectsNullRequest() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("请求体不能为空");
    }

    @Test
    void respondToDemandRejectsBlankMessage() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest(" ");

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("响应说明不能为空");
    }

    @Test
    void respondToDemandRejectsNegativePrice() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("PORTRAIT", "NJU"));
        CreateDemandResponseRequest request = responseRequest("价格非法");
        request.setExpectedPriceCent(-1);

        assertThatThrownBy(() -> demandService.respondToDemand(demand.getDemandId(), provider, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("预期报价不能为负数");
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
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("只有需求发布者");
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
        assertThat(result.getNextAction()).isEqualTo("PASS_SNAPSHOT_TO_C_CREATE_CONVERSATION");
    }

    @Test
    void acceptResponseMarksDemandMatchedAndResponseAccepted() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我来接"));

        demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThat(demandRepository.findById(demand.getDemandId()).orElseThrow().getStatus())
                .isEqualTo(DemandStatus.MATCHED);
        assertThat(responseRepository.findById(response.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.ACCEPTED);
    }

    @Test
    void acceptResponseRejectsOtherPendingResponses() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto accepted = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("第一位服务方"));
        DemandResponseDto rejected = demandService.respondToDemand(
                demand.getDemandId(), anotherProvider, responseRequest("第二位服务方"));

        demandService.acceptResponse(demand.getDemandId(), accepted.getResponseId(), customer);

        assertThat(responseRepository.findById(rejected.getResponseId()).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.REJECTED);
    }

    @Test
    void acceptResponseIsIdempotentForAcceptedResponse() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("GRADUATION", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("我来接"));

        AcceptDemandResponseResult first = demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);
        AcceptDemandResponseResult second = demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), customer);

        assertThat(second.getResponseId()).isEqualTo(first.getResponseId());
        assertThat(second.getProviderId()).isEqualTo(first.getProviderId());
    }

    @Test
    void acceptResponseRejectsNonOwnerCustomer() {
        DemandDto demand = demandService.createDemand(customer, demandRequest("TRAVEL", "NJU"));
        DemandResponseDto response = demandService.respondToDemand(
                demand.getDemandId(), provider, responseRequest("旅行跟拍我熟"));

        assertThatThrownBy(() -> demandService.acceptResponse(demand.getDemandId(), response.getResponseId(), otherCustomer))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("只有需求发布者");
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
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("尚未被接受");
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
