package com.action.camera.auth.sms.aliyun;

public interface AliyunSmsGateway {

    AliyunSmsResult send(String phone, String signName, String templateCode, String templateParameters);
}
