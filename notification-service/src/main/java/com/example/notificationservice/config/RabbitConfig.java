package com.example.notificationservice.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.DefaultJackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ topolojisi:
 *
 *   task.events (topic) --"task.*"--> notification.queue --(hata)--> task.events.dlx --> notification.dlq
 *
 * Retry sayısı application.properties'te; tükenen mesaj reddedilir ve
 * x-dead-letter ayarı sayesinde notification.dlq kuyruğuna düşer.
 */
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "task.events";
    public static final String QUEUE = "notification.queue";
    public static final String DLX = "task.events.dlx";
    public static final String DLQ = "notification.dlq";

    @Bean
    public TopicExchange taskEventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX, true, false);
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", DLQ)
                .build();
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    public Binding notificationBinding() {
        return BindingBuilder.bind(notificationQueue()).to(taskEventsExchange()).with("task.*");
    }

    @Bean
    public Binding deadLetterBinding() {
        return BindingBuilder.bind(deadLetterQueue()).to(deadLetterExchange()).with(DLQ);
    }

    // JSON dönüştürücü. Tip, mesajdaki __TypeId__ başlığından DEĞİL, listener
    // parametresinden (TaskEvent) çıkarılır; böylece Task Service'teki sınıf adı önemsizdir.
    @Bean
    public MessageConverter jsonMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        DefaultJackson2JavaTypeMapper typeMapper = new DefaultJackson2JavaTypeMapper();
        typeMapper.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        typeMapper.setTrustedPackages("*");
        converter.setJavaTypeMapper(typeMapper);
        return converter;
    }
}
