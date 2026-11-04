import com.action.camera.CameraApplication;
import com.action.camera.auth.sms.*;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.annotation.*;

// Test harness only: loaded outside the release JAR, loopback + in-memory H2.
public class ProtocolHarness {
  @Configuration(proxyBeanMethods=false)
  public static class SmsTestTransport {
    @Bean @Primary SmsSender protocolSmsSender() {
      return message -> {
        System.out.println("PROTOCOL_SMS=" + message.code());
        return new SmsDeliveryReceipt("isolated-protocol-test");
      };
    }
  }
  public static void main(String[] args) {
    var app = new SpringApplication(CameraApplication.class, SmsTestTransport.class);
    var context = (ServletWebServerApplicationContext) app.run(
      "--spring.config.location=file:./config/application.yml",
      "--spring.profiles.active=smoke", "--server.address=127.0.0.1", "--server.port=0",
      "--spring.http.client.factory=simple", "--camera.sms.resend-cooldown=1ms",
      "--camera.sms.phone-hourly-limit=100", "--camera.sms.phone-daily-limit=100",
      "--camera.sms.ip-hourly-limit=100", "--camera.sms.ip-daily-limit=100",
      "--camera.sms.device-hourly-limit=100", "--camera.sms.device-daily-limit=100");
    System.out.println("PROTOCOL_PORT=" + context.getWebServer().getPort());
  }
}
