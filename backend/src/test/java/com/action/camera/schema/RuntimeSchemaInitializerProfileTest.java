package com.action.camera.schema;

import com.action.camera.message.config.ConversationSchemaInitializer;
import com.action.camera.social.config.MomentSchemaInitializer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RuntimeSchemaInitializerProfileTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(JdbcTemplate.class, () -> jdbc)
            .withUserConfiguration(ConversationSchemaInitializer.class, MomentSchemaInitializer.class);

    @ParameterizedTest
    @ValueSource(strings = {"integration", "staging,integration", "integration,staging", "prod,integration"})
    void integrationDefaultsOffWithoutAnyYaml(String profiles) {
        runner.withPropertyValues("spring.profiles.active=" + profiles).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(ConversationSchemaInitializer.class);
            assertThat(context).doesNotHaveBean(MomentSchemaInitializer.class);
            verify(jdbc).afterPropertiesSet(); // Normal bean lifecycle, not database access.
            verifyNoMoreInteractions(jdbc);
        });
    }

    @Test
    void integrationCannotEnableDdlByEnvironmentOverride() {
        runner.withPropertyValues("spring.profiles.active=integration",
                "camera.integration.runtime-ddl-enabled=true").run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasStackTraceContaining(
                    "camera.integration.runtime-ddl-enabled must be false");
            verifyNoInteractions(jdbc);
        });
    }

    @ParameterizedTest
    @ValueSource(strings = {"default", "staging", "prod", "dev", "smoke", "temp-staging"})
    void otherProfilesKeepBothInitializersEvenWithIntegrationSettingPresent(String profile) {
        runner.withPropertyValues("spring.profiles.active=" + profile,
                "camera.integration.runtime-ddl-enabled=false").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(ConversationSchemaInitializer.class);
            assertThat(context).hasSingleBean(MomentSchemaInitializer.class);
        });
    }
}
