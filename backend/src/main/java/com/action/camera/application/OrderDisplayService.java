package com.action.camera.application;

import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OrderDisplayService {

    private final OrderRepository orderRepository;
    private final DemandRepository demandRepository;
    private final ServicePackageRepository servicePackageRepository;

    public String resolveOrderSubject(Long orderId) {
        if (orderId == null) {
            return "这笔订单";
        }
        return orderRepository.findById(orderId)
                .map(this::resolveOrderSubject)
                .orElse("这笔订单");
    }

    public String resolveOrderSubject(Order order) {
        if (order == null) {
            return "这笔订单";
        }
        String servicePackageTitle = resolveServicePackageTitle(order.getServicePackageId());
        if (!servicePackageTitle.isBlank()) {
            return "橱窗「" + servicePackageTitle + "」";
        }
        String demandScene = resolveDemandScene(order.getDemandId());
        if (!demandScene.isBlank()) {
            return "需求「" + demandScene + "」";
        }
        return "这笔订单";
    }

    private String resolveServicePackageTitle(Long servicePackageId) {
        if (servicePackageId == null) {
            return "";
        }
        return servicePackageRepository.findById(servicePackageId)
                .map(ServicePackage::getTitle)
                .map(this::normalizeText)
                .orElse("");
    }

    private String resolveDemandScene(Long demandId) {
        if (demandId == null) {
            return "";
        }
        return demandRepository.findById(demandId)
                .map(Demand::getScene)
                .map(this::normalizeText)
                .orElse("");
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }
}
