package com.action.camera.common.config;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.env.Profiles;
import org.springframework.core.type.AnnotatedTypeMetadata;

/** Integration uses reviewed migrations and a DML-only application account. */
public final class RuntimeSchemaInitializationCondition implements Condition {
    public static final String ENABLED = "camera.integration.runtime-ddl-enabled";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        if (!context.getEnvironment().acceptsProfiles(Profiles.of("integration"))) {
            // This integration-only setting must not alter existing environments.
            return true;
        }
        if (context.getEnvironment().getProperty(ENABLED, Boolean.class, false)) {
            throw new IllegalStateException(ENABLED + " must be false for the integration profile");
        }
        // Fail closed even when application-integration.yml is not loaded.
        return false;
    }
}
