package com.action.camera.servicepackage;

import com.action.camera.servicepackage.controller.ServicePackageController;
import com.action.camera.servicepackage.controller.ServicePackageInterestController;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ServicePackageFlowTest {

    @Test
    void servicePackageEntityCarriesShowcaseAndTimeContractFields() {
        List<String> fieldNames = Arrays.stream(ServicePackage.class.getDeclaredFields())
                .map(Field::getName)
                .toList();

        assertThat(fieldNames)
                .contains(
                        "providerId",
                        "images",
                        "priceRange",
                        "description",
                        "styleTags",
                        "timeDescription",
                        "timeTags",
                        "status",
                        "createdAt",
                        "updatedAt"
                )
                .doesNotContain("providerProfileId");
        assertThat(ServicePackageStatus.values()).containsExactly(ServicePackageStatus.ONLINE, ServicePackageStatus.OFFLINE);
    }

    @Test
    void interestEntityAndRepositoryUseRealPersistenceModel() {
        List<String> fieldNames = Arrays.stream(ServicePackageInterest.class.getDeclaredFields())
                .map(Field::getName)
                .toList();

        assertThat(fieldNames).contains("id", "userId", "servicePackageId", "createdAt");
        assertThat(ServicePackageInterestRepository.class.getInterfaces())
                .anySatisfy(type -> assertThat(type.getSimpleName()).isEqualTo("JpaRepository"));
        assertThat(ServicePackageRepository.class.getInterfaces())
                .anySatisfy(type -> assertThat(type.getSimpleName()).isEqualTo("JpaRepository"));
    }

    @Test
    void controllerExposesTargetShowcaseEndpoints() {
        List<String> methodNames = Arrays.stream(ServicePackageController.class.getDeclaredMethods())
                .map(java.lang.reflect.Method::getName)
                .toList();

        assertThat(methodNames).contains(
                "createServicePackage",
                "listServices",
                "getServiceDetail",
                "updateServicePackage",
                "offlineServicePackage",
                "addInterest",
                "cancelInterest",
                "startChat"
        );
        assertThat(hasAnnotation("updateServicePackage", PutMapping.class)).isTrue();
        assertThat(hasAnnotation("offlineServicePackage", PatchMapping.class)).isTrue();
        assertThat(hasAnnotation("addInterest", PostMapping.class)).isTrue();
        assertThat(hasAnnotation("cancelInterest", DeleteMapping.class)).isTrue();
        assertThat(hasAnnotation("startChat", PostMapping.class)).isTrue();
    }

    @Test
    void myInterestEndpointLivesAtMeRootController() {
        assertThat(Arrays.stream(ServicePackageInterestController.class.getDeclaredMethods())
                .anyMatch(method -> method.getName().equals("listMyInterests")
                        && method.isAnnotationPresent(GetMapping.class)))
                .isTrue();
    }

    @Test
    void serviceNoLongerOwnsPaymentOrderOrScheduleDependencies() {
        List<String> serviceFieldTypes = Arrays.stream(ServicePackageService.class.getDeclaredFields())
                .map(Field::getType)
                .map(Class::getSimpleName)
                .toList();

        assertThat(serviceFieldTypes)
                .contains(
                        "ServicePackageRepository",
                        "ServicePackageInterestRepository",
                        "ConversationService",
                        "UserRepository",
                        "FileRepository"
                )
                .doesNotContain("ScheduleService", "OrderService", "PaymentService");
    }

    private boolean hasAnnotation(String methodName,
                                  Class<? extends java.lang.annotation.Annotation> annotationClass) {
        return Arrays.stream(ServicePackageController.class.getDeclaredMethods())
                .filter(method -> method.getName().equals(methodName))
                .anyMatch(method -> method.isAnnotationPresent(annotationClass));
    }
}
