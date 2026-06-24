package com.action.camera.servicepackage.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.servicepackage.dto.CreateServicePackageRequest;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ReserveServicePackageRequest;
import com.action.camera.servicepackage.dto.ReserveServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageDetailDto;
import com.action.camera.servicepackage.dto.ServicePackageInterestDto;
import com.action.camera.servicepackage.dto.StartServicePackageChatRequest;
import com.action.camera.servicepackage.dto.StartServicePackageChatResult;
import com.action.camera.servicepackage.dto.UpdateServicePackageRequest;
import com.action.camera.servicepackage.service.ServicePackageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping({"/services", "/service-packages"})
public class ServicePackageController {

    private final ServicePackageService servicePackageService;
    private final MockCurrentUserProvider currentUserProvider;

    public ServicePackageController(ServicePackageService servicePackageService,
                                    MockCurrentUserProvider currentUserProvider) {
        this.servicePackageService = servicePackageService;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping
    public Result<CreateServicePackageResult> createServicePackage(@RequestBody CreateServicePackageRequest request,
                                                                   HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.createServicePackage(currentUser, request));
    }

    @GetMapping
    public Result<PageResult<ServicePackageCardDto>> listServices(@RequestParam(defaultValue = "1") int page,
                                                                  @RequestParam(defaultValue = "10") int size,
                                                                  @RequestParam(required = false) String cityCode,
                                                                  @RequestParam(required = false) String city,
                                                                  @RequestParam(required = false) String scene,
                                                                  @RequestParam(required = false) String style,
                                                                  @RequestParam(required = false) Long minPriceCent,
                                                                  @RequestParam(required = false) Long maxPriceCent,
                                                                  @RequestParam(required = false) LocalDate availableDate,
                                                                  @RequestParam(required = false) String timeTag,
                                                                  @RequestParam(required = false) String keyword,
                                                                  @RequestParam(required = false) String sort,
                                                                  @RequestParam(required = false) String feedSeed,
                                                                  HttpServletRequest httpRequest) {
        String resolvedCity = cityCode == null ? city : cityCode;
        CurrentUser currentUser = currentUserProvider.getCurrentUserIfPresent(httpRequest).orElse(null);
        return Result.success(servicePackageService.listServices(
                page,
                size,
                resolvedCity,
                scene,
                style,
                minPriceCent,
                maxPriceCent,
                availableDate,
                timeTag,
                keyword,
                sort,
                feedSeed,
                currentUser
        ));
    }

    @GetMapping("/me/history")
    public Result<List<ServicePackageCardDto>> listMyServicePackageHistory(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.listMyServicePackageHistory(currentUser));
    }

    @GetMapping("/{serviceId}")
    public Result<ServicePackageDetailDto> getServiceDetail(@PathVariable Long serviceId,
                                                            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUserIfPresent(httpRequest).orElse(null);
        return Result.success(servicePackageService.getServiceDetail(serviceId, currentUser));
    }

    @PutMapping("/{serviceId}")
    public Result<ServicePackageDetailDto> updateServicePackage(@PathVariable Long serviceId,
                                                                @RequestBody UpdateServicePackageRequest request,
                                                                HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.updateServicePackage(serviceId, currentUser, request));
    }

    @PatchMapping("/{serviceId}/offline")
    public Result<ServicePackageDetailDto> offlineServicePackage(@PathVariable Long serviceId,
                                                                 HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.offlineServicePackage(serviceId, currentUser));
    }

    @DeleteMapping("/{serviceId}")
    public Result<Void> hideServicePackage(@PathVariable Long serviceId,
                                           HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        servicePackageService.hideServicePackage(serviceId, currentUser);
        return Result.success(null);
    }

    @PostMapping("/{serviceId}/reserve")
    public Result<ReserveServicePackageResult> reserveServicePackage(@PathVariable Long serviceId,
                                                                     @RequestBody ReserveServicePackageRequest request,
                                                                     HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.reserveServicePackage(serviceId, currentUser, request));
    }

    @PostMapping("/{serviceId}/interest")
    public Result<ServicePackageInterestDto> addInterest(@PathVariable Long serviceId,
                                                         HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.addInterest(serviceId, currentUser));
    }

    @DeleteMapping("/{serviceId}/interest")
    public Result<Void> cancelInterest(@PathVariable Long serviceId,
                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        servicePackageService.cancelInterest(serviceId, currentUser);
        return Result.success(null);
    }

    @PostMapping("/{serviceId}/start-chat")
    public Result<StartServicePackageChatResult> startChat(@PathVariable Long serviceId,
                                                           @RequestBody(required = false)
                                                           StartServicePackageChatRequest request,
                                                           HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.startChat(serviceId, currentUser, request));
    }
}
