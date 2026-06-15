package com.action.camera.application;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Service
public class IpLocationService {

    private final RestTemplate restTemplate;

    public IpLocationService(RestTemplateBuilder builder) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(3))
                .build();
    }

    /**
     * 根据 IP 查省级归属地（"江苏"、"北京" 等），失败返回 null。
     */
    public String resolveProvince(String ip) {
        if (ip == null || isPrivateOrLoopback(ip)) return null;
        try {
            String url = "http://ip-api.com/json/" + ip + "?lang=zh-CN&fields=status,regionName";
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.getForObject(url, Map.class);
            if (result == null || !"success".equals(result.get("status"))) return null;
            return stripSuffix((String) result.get("regionName"));
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isPrivateOrLoopback(String ip) {
        return ip.startsWith("127.") || ip.startsWith("192.168.")
                || ip.startsWith("10.") || ip.startsWith("172.")
                || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1");
    }

    private static String stripSuffix(String region) {
        if (region == null || region.isBlank()) return null;
        return region.replaceAll("(省|市|自治区|特别行政区)$", "").trim();
    }
}
