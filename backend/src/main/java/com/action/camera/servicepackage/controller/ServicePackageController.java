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
import com.action.camera.servicepackage.service.ServicePackageService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/services")
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
                                                                  @RequestParam(required = false) String sort) {
        String resolvedCity = cityCode == null ? city : cityCode;
        return Result.success(servicePackageService.listServices(
                page,
                size,
                resolvedCity,
                scene,
                style,
                minPriceCent,
                maxPriceCent,
                availableDate,
                sort
        ));
    }

    @GetMapping("/{serviceId}")
    public Result<ServicePackageDetailDto> getServiceDetail(@PathVariable Long serviceId) {
        return Result.success(servicePackageService.getServiceDetail(serviceId));
    }

    @PostMapping("/{serviceId}/reserve")
    public Result<ReserveServicePackageResult> reserveServicePackage(@PathVariable Long serviceId,
                                                                     @RequestBody ReserveServicePackageRequest request,
                                                                     HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(servicePackageService.reserveServicePackage(serviceId, currentUser, request));
    }
}
