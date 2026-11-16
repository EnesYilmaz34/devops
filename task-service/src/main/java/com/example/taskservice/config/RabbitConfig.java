package com.example.taskservice.config;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {

    public static final String EXCHANGE = "task.events";

    // Exchange burada da tanımlanır: Notification Service henüz ayağa kalkmamış olsa bile
    // yayınlanan olaylar kaybolmaz (kuyruk bağlantısı tüketici tarafında kurulur).
    @Bean
    public TopicExchange taskEventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    // Olaylar JSON olarak gönderilir (RabbitTemplate bu bean'i otomatik kullanır)
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
