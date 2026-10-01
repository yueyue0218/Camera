package com.action.camera.tempstaging;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.MailException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessagePreparator;

import java.io.InputStream;
import java.util.Properties;

@Configuration(proxyBeanMethods = false)
@Profile("temp-staging")
public class TempStagingMailConfig {

    @Bean
    JavaMailSender tempStagingDenyingMailSender() {
        return new DenyingJavaMailSender();
    }

    private static final class DenyingJavaMailSender implements JavaMailSender {

        @Override
        public MimeMessage createMimeMessage() {
            return new MimeMessage(Session.getInstance(new Properties()));
        }

        @Override
        public MimeMessage createMimeMessage(InputStream contentStream) throws MailException {
            try {
                return new MimeMessage(Session.getInstance(new Properties()), contentStream);
            } catch (Exception e) {
                throw new MailSendException("Unable to parse message", e);
            }
        }

        @Override
        public void send(MimeMessage mimeMessage) {
            deny();
        }

        @Override
        public void send(MimeMessage... mimeMessages) {
            deny();
        }

        @Override
        public void send(MimeMessagePreparator mimeMessagePreparator) {
            deny();
        }

        @Override
        public void send(MimeMessagePreparator... mimeMessagePreparators) {
            deny();
        }

        @Override
        public void send(SimpleMailMessage simpleMessage) {
            deny();
        }

        @Override
        public void send(SimpleMailMessage... simpleMessages) {
            deny();
        }

        private void deny() {
            throw new MailSendException("Real email is disabled in temp-staging");
        }
    }
}
