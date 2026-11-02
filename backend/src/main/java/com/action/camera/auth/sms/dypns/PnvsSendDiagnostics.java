package com.action.camera.auth.sms.dypns;

import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeRequest;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/** Projects untrusted provider messages onto a fixed vocabulary; never logs raw payloads. */
final class PnvsSendDiagnostics {
    private static final Set<String> MESSAGE_WORDS = Set.of(
            "PhoneNumber", "CountryCode", "SchemeName", "SignName", "TemplateCode", "TemplateParam",
            "CodeType", "CodeLength", "ValidTime", "Interval", "DuplicatePolicy", "ReturnVerifyCode",
            "invalid", "parameter", "parameters", "missing", "required", "format", "length",
            "range", "empty", "unsupported");

    private PnvsSendDiagnostics() { }

    static void rejected(SendSmsVerifyCodeRequest request, String code, String message,
                         Object requestId, Integer httpStatus, String endpoint, long providerElapsedMs) {
        String phone = request.getPhoneNumber();
        LoggerFactory.getLogger(PnvsSendDiagnostics.class).warn(
                "PNVS_SEND_REJECTED code={} message={} requestId={} httpStatus={} "
                        + "phoneLength={} phoneDigitsOnly={} phoneMainlandFormat={} countryCode={} "
                        + "schemeState={} signLength={} templateIdLength={} "
                        + "codeType={} codeLength={} validTime={} interval={} duplicatePolicy={} "
                        + "returnVerifyCode={} templateMode=CLOUD_CODE_AND_MIN endpoint={} providerElapsedMs={}",
                safeCode(code), safeMessage(message), safeRequestId(requestId), httpStatus,
                phone == null ? 0 : phone.length(), phone != null && phone.matches("[0-9]+"),
                phone != null && phone.matches("1[3-9][0-9]{9}"),
                "86".equals(request.getCountryCode()) ? "86" : "OTHER_OR_MISSING",
                request.getSchemeName() == null ? "OMITTED" : request.getSchemeName().isEmpty() ? "EMPTY" : "NONEMPTY",
                request.getSignName() == null ? 0 : request.getSignName().length(),
                request.getTemplateCode() == null ? 0 : request.getTemplateCode().length(),
                request.getCodeType(), request.getCodeLength(), request.getValidTime(), request.getInterval(),
                request.getDuplicatePolicy(), request.getReturnVerifyCode(),
                "dypnsapi.aliyuncs.com".equals(endpoint) ? "dypnsapi.aliyuncs.com" : "OTHER_OR_MISSING", providerElapsedMs);
    }

    static String safeMessage(String message) {
        if (message == null || message.isBlank()) {
            return "UNAVAILABLE";
        }
        // Unlike regex masking, a fixed vocabulary cannot leak unknown secret formats,
        // encoded phone numbers, a server-generated code, or credentials echoed by the provider.
        Set<String> words = new LinkedHashSet<>();
        Arrays.stream(message.substring(0, Math.min(message.length(), 4096)).split("[^A-Za-z]+"))
                .filter(MESSAGE_WORDS::contains).forEach(words::add);
        return words.isEmpty() ? "REDACTED" : String.join(" ", words) + " [OTHER_REDACTED]";
    }

    static String safeCode(String code) {
        if (code == null) {
            return "UNAVAILABLE";
        }
        return code.matches("(?:isv|isp)\\.[A-Z_]{1,64}|OK|NO_BODY") ? code : "REDACTED";
    }

    static String safeRequestId(Object value) {
        return value instanceof String id
                && id.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
                ? id : "UNAVAILABLE_OR_REDACTED";
    }

    static Object requestId(String bodyId, Map<String, String> headers) {
        if (!safeRequestId(bodyId).equals("UNAVAILABLE_OR_REDACTED")) {
            return bodyId;
        }
        if (headers != null) {
            for (var entry : headers.entrySet()) {
                if ("x-acs-request-id".equalsIgnoreCase(entry.getKey())) {
                    return entry.getValue();
                }
            }
        }
        return null;
    }
}
