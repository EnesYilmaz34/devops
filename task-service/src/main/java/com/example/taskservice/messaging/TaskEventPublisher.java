package com.example.taskservice.messaging;

import com.example.taskservice.config.RabbitConfig;
import com.example.taskservice.model.Task;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class TaskEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(TaskEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;
    private final Counter publishFailures;

    public TaskEventPublisher(RabbitTemplate rabbitTemplate, MeterRegistry registry) {
        this.rabbitTemplate = rabbitTemplate;
        this.publishFailures = Counter.builder("task.events.publish.failures")
                .description("RabbitMQ'ya yayınlanamayan olay sayısı")
                .register(registry);
    }

    /**
     * Olayı yayınlar. Broker kapalıysa görev isteği BAŞARISIZ OLMAZ:
     * hata loglanır ve sayaç artırılır (asenkron iletişimin amacı budur).
     */
    public void publish(String type, Task task) {
        TaskEvent event = new TaskEvent(
                UUID.randomUUID().toString(), type, task.getId(),
                task.getOwner(), task.getTitle(), Instant.now().toString());
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, type, event);
        } catch (Exception e) {
            publishFailures.increment();
            log.warn("Event could not be published type={} taskId={} reason={}", type, task.getId(), e.getMessage());
        }
    }
}
