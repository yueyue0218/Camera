package com.action.camera.servicepackage.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class ReserveServicePackageRequest {

    private LocalDate selectedDate;

    private String initialMessage;
}
