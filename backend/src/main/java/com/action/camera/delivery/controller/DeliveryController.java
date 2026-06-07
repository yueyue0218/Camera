package com.action.camera.delivery.controller;

import com.action.camera.common.Result;
import com.action.camera.delivery.dto.DeliveryResponse;
import com.action.camera.delivery.dto.DeliveryUploadResponse;
import com.action.camera.delivery.service.DeliveryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/orders/{orderId}/deliveries")
public class DeliveryController {

    private final DeliveryService deliveryService;

    public DeliveryController(DeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @PostMapping
    public Result<DeliveryUploadResponse> upload(@PathVariable Long orderId,
                                                 @RequestParam("file") MultipartFile file,
                                                 @RequestParam(value = "remark", required = false) String remark) {
        return Result.success(deliveryService.upload(orderId, file, remark));
    }

    @GetMapping
    public Result<List<DeliveryResponse>> list(@PathVariable Long orderId) {
        return Result.success(deliveryService.listByOrder(orderId));
    }
}
