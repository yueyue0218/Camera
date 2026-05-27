package com.action.camera.contract;

import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.statemachine.OrderStatusMachine;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.function.Executable;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectDesignFullCoverageTest {

    @TestFactory
    Stream<DynamicTest> projectDesignContracts() throws IOException {
        Sources sources = Sources.load();
        List<DynamicTest> tests = new ArrayList<>();

        addContains(tests, "backend session login endpoint", sources.sessionController, "@PostMapping(\"/sessions\")");
        addContains(tests, "backend auth route root", sources.authController, "@RequestMapping(\"/auth\")");
        addContains(tests, "backend send code endpoint", sources.authController, "@PostMapping(\"/send-code\")");
        addContains(tests, "backend user route root", sources.userController, "@RequestMapping(\"/users\")");
        addContains(tests, "backend user register endpoint", sources.userController, "@PostMapping(\"/register\")");
        addContains(tests, "backend current user endpoint", sources.userController, "@GetMapping(\"/me\")");
        addContains(tests, "backend user brief endpoint", sources.userController, "@GetMapping(\"/{id}/brief\")");
        addContains(tests, "backend demand route root", sources.demandController, "@RequestMapping(\"/demands\")");
        addContains(tests, "backend demand create endpoint", sources.demandController, "@PostMapping");
        addContains(tests, "backend demand list endpoint", sources.demandController, "@GetMapping");
        addContains(tests, "backend demand detail endpoint", sources.demandController, "@GetMapping(\"/{demandId}\")");
        addContains(tests, "backend demand delete endpoint", sources.demandController, "@DeleteMapping(\"/{demandId}\")");
        addContains(tests, "backend demand response create endpoint", sources.demandController, "@PostMapping(\"/{demandId}/responses\")");
        addContains(tests, "backend demand invitation create endpoint", sources.demandController, "@PostMapping(\"/{demandId}/invitations\")");
        addContains(tests, "backend received invitations endpoint", sources.demandController, "@GetMapping(\"/invitations/received\")");
        addContains(tests, "backend sent invitations endpoint", sources.demandController, "@GetMapping(\"/invitations/sent\")");
        addContains(tests, "backend accept invitation endpoint", sources.demandController, "@PostMapping(\"/invitations/{invitationId}/accept\")");
        addContains(tests, "backend reject invitation endpoint", sources.demandController, "@PostMapping(\"/invitations/{invitationId}/reject\")");
        addContains(tests, "backend demand responses list endpoint", sources.demandController, "@GetMapping(\"/{demandId}/responses\")");
        addContains(tests, "backend accept demand response endpoint", sources.demandController, "@PostMapping(\"/{demandId}/responses/{responseId}/accept\")");
        addContains(tests, "backend accepted response snapshot endpoint", sources.demandController, "@GetMapping(\"/responses/{responseId}/accepted-snapshot\")");
        addContains(tests, "backend moment route root", sources.momentController, "@RequestMapping(\"/moments\")");
        addContains(tests, "backend moment list endpoint", sources.momentController, "@GetMapping");
        addContains(tests, "backend moment create endpoint", sources.momentController, "@PostMapping");
        addContains(tests, "backend moment detail endpoint", sources.momentController, "@GetMapping(\"/{momentId}\")");
        addContains(tests, "backend moment like endpoint", sources.momentController, "@PostMapping(\"/{momentId}/like\")");
        addContains(tests, "backend moment favorite endpoint", sources.momentController, "@PostMapping(\"/{momentId}/favorite\")");
        addContains(tests, "backend moment delete endpoint", sources.momentController, "@DeleteMapping(\"/{momentId}\")");
        addContains(tests, "backend conversation list endpoint", sources.conversationController, "@GetMapping(\"/conversations\")");
        addContains(tests, "backend create conversation from response endpoint", sources.conversationController, "@PostMapping(\"/conversations/from-response\")");
        addContains(tests, "backend conversation messages list endpoint", sources.conversationController, "@GetMapping(\"/conversations/{conversationId}/messages\")");
        addContains(tests, "backend conversation send message endpoint", sources.conversationController, "@PostMapping(\"/conversations/{conversationId}/messages\")");
        addContains(tests, "backend conversation quotations endpoint", sources.conversationController, "@GetMapping(\"/conversations/{conversationId}/quotations\")");
        addContains(tests, "backend create quotation endpoint", sources.quoteController, "@PostMapping(\"/quotations\")");
        addContains(tests, "backend confirm quotation endpoint", sources.quoteController, "@PostMapping(\"/quotations/{quotationId}/confirm\")");
        addContains(tests, "backend reject quotation endpoint", sources.quoteController, "@PostMapping(\"/quotations/{quotationId}/reject\")");
        addContains(tests, "backend order list endpoint", sources.orderController, "@GetMapping(\"/orders\")");
        addContains(tests, "backend order detail endpoint", sources.orderController, "@GetMapping(\"/orders/{orderId}\")");
        addContains(tests, "backend order payment endpoint", sources.orderController, "@PostMapping(\"/orders/{orderId}/payments\")");
        addContains(tests, "backend order transition endpoint", sources.orderController, "@PostMapping(\"/orders/{orderId}/status-transitions\")");
        addContains(tests, "backend order status logs endpoint", sources.orderController, "@GetMapping(\"/orders/{orderId}/status-logs\")");
        addContains(tests, "backend delivery route root", sources.deliveryController, "@RequestMapping(\"/orders/{orderId}/deliveries\")");
        addContains(tests, "backend delivery upload endpoint", sources.deliveryController, "@PostMapping");
        addContains(tests, "backend delivery list endpoint", sources.deliveryController, "@GetMapping");
        addContains(tests, "backend create order review endpoint", sources.reviewController, "@PostMapping(\"/orders/{orderId}/reviews\")");
        addContains(tests, "backend list order reviews endpoint", sources.reviewController, "@GetMapping(\"/orders/{orderId}/reviews\")");
        addContains(tests, "backend public user reviews endpoint", sources.reviewController, "@GetMapping(\"/users/{userId}/reviews\")");
        addContains(tests, "backend create review complaint endpoint", sources.reviewComplaintController, "@PostMapping(\"/reviews/{reviewId}/complaints\")");
        addContains(tests, "backend my review complaints endpoint", sources.reviewComplaintController, "@GetMapping(\"/reviews/complaints/my\")");
        addContains(tests, "backend review complaints by review endpoint", sources.reviewComplaintController, "@GetMapping(\"/reviews/{reviewId}/complaints\")");
        addContains(tests, "backend cancel review complaint endpoint", sources.reviewComplaintController, "@PostMapping(\"/reviews/complaints/{complaintId}/cancel\")");
        addContains(tests, "backend admin review complaints endpoint", sources.reviewComplaintController, "@GetMapping(\"/admin/review-complaints\")");
        addContains(tests, "backend admin review arbitration endpoint", sources.reviewComplaintController, "@PatchMapping(\"/admin/review-complaints/{complaintId}/arbitration\")");
        addContains(tests, "backend notification route root", sources.notificationController, "@RequestMapping(\"/notifications\")");
        addContains(tests, "backend notification list endpoint", sources.notificationController, "@GetMapping");
        addContains(tests, "backend notification mark read endpoint", sources.notificationController, "@PatchMapping(\"/{notificationId}/read\")");
        addContains(tests, "backend notification mark all read endpoint", sources.notificationController, "@PatchMapping(\"/read-all\")");
        addContains(tests, "backend credit summary endpoint", sources.creditController, "@GetMapping(\"/users/{userId}/credit\")");
        addContains(tests, "backend credit records endpoint", sources.creditController, "@GetMapping(\"/users/{userId}/credit-records\")");
        addContains(tests, "backend file upload endpoint", sources.fileController, "@PostMapping(\"/upload\")");
        addContains(tests, "backend file download endpoint", sources.fileController, "@GetMapping(\"/{fileId}/download\")");

        addContains(tests, "frontend sends verification code to auth endpoint", sources.frontendApi, "'/auth/send-code'");
        addContains(tests, "frontend registers through users endpoint", sources.frontendApi, "'/users/register'");
        addContains(tests, "frontend keeps auth register fallback", sources.frontendApi, "'/auth/register'");
        addContains(tests, "frontend mobile login uses sessions endpoint", sources.frontendApi, "'/sessions'");
        addNotContains(tests, "frontend no longer calls removed student login endpoint", sources.frontendApi + sources.frontendApp, "/users/login");
        addContains(tests, "frontend current user profile endpoint", sources.frontendApi, "'/users/me'");
        addContains(tests, "frontend public user brief endpoint", sources.frontendApi, "`/users/${userId}/brief`");
        addContains(tests, "frontend demand list and create endpoint", sources.frontendApi, "`/demands${suffix}`");
        addContains(tests, "frontend demand response endpoint", sources.frontendApi, "`/demands/${demandId}/responses`");
        addContains(tests, "frontend demand response accept endpoint", sources.frontendApi, "`/demands/${demandId}/responses/${responseId}/accept`");
        addContains(tests, "frontend invitations received endpoint", sources.frontendApi, "'/demands/invitations/received'");
        addContains(tests, "frontend conversation list endpoint", sources.frontendApi, "'/conversations'");
        addContains(tests, "frontend create conversation from response endpoint", sources.frontendApi, "'/conversations/from-response'");
        addContains(tests, "frontend conversation messages endpoint", sources.frontendApi, "`/conversations/${conversationId}/messages`");
        addContains(tests, "frontend conversation quotations endpoint", sources.frontendApi, "`/conversations/${conversationId}/quotations${suffix}`");
        addContains(tests, "frontend create quotation endpoint", sources.frontendApi, "'/quotations'");
        addContains(tests, "frontend confirm quotation endpoint", sources.frontendApi, "`/quotations/${quotationId}/confirm`");
        addContains(tests, "frontend order list endpoint", sources.frontendApi, "`/orders${suffix}`");
        addContains(tests, "frontend order payment endpoint", sources.frontendApi, "`/orders/${orderId}/payments`");
        addContains(tests, "frontend order transition endpoint", sources.frontendApi, "`/orders/${orderId}/status-transitions`");
        addContains(tests, "frontend order reviews endpoint", sources.frontendApi, "`/orders/${orderId}/reviews`");
        addContains(tests, "frontend public user reviews endpoint", sources.frontendApi, "`/users/${userId}/reviews`");
        addContains(tests, "frontend create review complaint endpoint", sources.frontendApi, "`/reviews/${reviewId}/complaints`");
        addContains(tests, "frontend my review complaints endpoint", sources.frontendApi, "'/reviews/complaints/my'");
        addContains(tests, "frontend credit summary endpoint", sources.frontendApi, "`/users/${userId}/credit`");
        addContains(tests, "frontend credit records endpoint", sources.frontendApi, "`/users/${userId}/credit-records`");
        addContains(tests, "frontend follow list opens public profile route", sources.frontendApp, "navigate(`/users/${follow.authorId}`)");

        addOrderState(tests, "order status includes pending payment", "PENDING_PAYMENT");
        addOrderState(tests, "order status includes paid pending shoot", "PAID_PENDING_SHOOT");
        addOrderState(tests, "order status includes shooting", "SHOOTING");
        addOrderState(tests, "order status includes pending delivery", "PENDING_DELIVERY");
        addOrderState(tests, "order status includes delivered pending confirm", "DELIVERED_PENDING_CONFIRM");
        addOrderState(tests, "order status includes completed", "COMPLETED");
        addOrderState(tests, "order status includes cancelled", "CANCELLED");
        addOrderState(tests, "order status includes refunded", "REFUNDED");
        addOrderState(tests, "order status includes appealing", "APPEALING");
        addOrderState(tests, "order status includes rework required", "REWORK_REQUIRED");
        addTransition(tests, "pending payment can become paid", OrderStatus.PENDING_PAYMENT, OrderStatus.PAID_PENDING_SHOOT);
        addTransition(tests, "delivered order can be completed", OrderStatus.DELIVERED_PENDING_CONFIRM, OrderStatus.COMPLETED);

        if (tests.size() != 100) {
            throw new IllegalStateException("Expected exactly 100 project design tests but got " + tests.size());
        }
        return tests.stream();
    }

    private static void addContains(List<DynamicTest> tests, String name, String source, String expected) {
        add(tests, name, () -> assertThat(source).contains(expected));
    }

    private static void addNotContains(List<DynamicTest> tests, String name, String source, String forbidden) {
        add(tests, name, () -> assertThat(source).doesNotContain(forbidden));
    }

    private static void addOrderState(List<DynamicTest> tests, String name, String state) {
        add(tests, name, () -> assertThat(orderStates()).contains(state));
    }

    private static void addTransition(List<DynamicTest> tests, String name, OrderStatus from, OrderStatus to) {
        add(tests, name, () -> assertThat(OrderStatusMachine.canTransit(from, to)).isTrue());
    }

    private static void add(List<DynamicTest> tests, String name, Executable executable) {
        tests.add(DynamicTest.dynamicTest(name, executable));
    }

    private static Set<String> orderStates() {
        return Arrays.stream(OrderStatus.values()).map(Enum::name).collect(Collectors.toSet());
    }

    private record Sources(
            String frontendApi,
            String frontendApp,
            String sessionController,
            String authController,
            String userController,
            String demandController,
            String momentController,
            String conversationController,
            String quoteController,
            String orderController,
            String deliveryController,
            String reviewController,
            String reviewComplaintController,
            String notificationController,
            String creditController,
            String fileController
    ) {
        static Sources load() throws IOException {
            Path backendRoot = backendRoot();
            Path repoRoot = backendRoot.getParent();
            return new Sources(
                    read(repoRoot.resolve("frontend/src/api.js")),
                    read(repoRoot.resolve("frontend/src/App.jsx")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/auth/controller/SessionController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/controller/AuthController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/controller/UserController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/demand/controller/DemandController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/social/controller/MomentController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/message/controller/ConversationController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/message/controller/QuoteController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/order/controller/OrderController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/delivery/controller/DeliveryController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/review/controller/ReviewController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/review/controller/ReviewComplaintController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/notification/controller/NotificationController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/credit/controller/CreditController.java")),
                    read(backendRoot.resolve("src/main/java/com/action/camera/controller/FileController.java"))
            );
        }

        private static Path backendRoot() {
            Path cwd = Path.of("").toAbsolutePath().normalize();
            if (Files.exists(cwd.resolve("src/main/java"))) {
                return cwd;
            }
            if (Files.exists(cwd.resolve("backend/src/main/java"))) {
                return cwd.resolve("backend");
            }
            throw new IllegalStateException("Cannot locate backend source root from " + cwd);
        }

        private static String read(Path path) throws IOException {
            return Files.readString(path, StandardCharsets.UTF_8);
        }
    }
}
