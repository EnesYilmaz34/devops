package com.example.notificationservice.listener;

import com.example.notificationservice.config.RabbitConfig;
import com.example.notificationservice.model.TaskEvent;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Component
public class NotificationListener {

    private static final Logger log = LoggerFactory.getLogger(NotificationListener.class);

    // Idempotency: aynı eventId ikinci kez gelirse yok sayılır (son 10.000 id hatırlanır)
    private final Set<String> processed = Collections.newSetFromMap(
            Collections.synchronizedMap(new LinkedHashMap<String, Boolean>() {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
                    return size() > 10_000;
                }
            }));

    private final MeterRegistry registry;

    public NotificationListener(MeterRegistry registry) {
        this.registry = registry;
    }

    @RabbitListener(queues = RabbitConfig.QUEUE)
    public void onTaskEvent(TaskEvent event) {
        if (!processed.add(event.eventId())) {
            log.info("Duplicate event ignored eventId={}", event.eventId());
            return;
        }

        // TEST DÜZENEĞİ: başlığında "FAIL" geçen görev, DLQ senaryosunu göstermek için
        // bilerek hata üretir. Retry tükenince mesaj notification.dlq'ya düşer.
        if (event.title() != null && event.title().toUpperCase().contains("FAIL")) {
            processed.remove(event.eventId());   // retry'da tekrar işlenebilsin
            throw new IllegalStateException("Simulated failure for eventId=" + event.eventId());
        }

        String message = switch (event.type()) {
            case "task.created" -> "Yeni görev oluşturuldu: " + event.title();
            case "task.completed" -> "Görev tamamlandı: " + event.title();
            case "task.deleted" -> "Görev silindi: " + event.title();
            default -> "Görev olayı (" + event.type() + "): " + event.title();
        };

        // Bildirim kanalı bu aşamada log'dur (simüle e-posta). Loki/Grafana'da aranabilir.
        log.info("NOTIFICATION to={} type={} taskId={} message=\"{}\"",
                event.owner(), event.type(), event.taskId(), message);

        Counter.builder("notifications.sent")
                .description("Gönderilen bildirim sayısı")
                .tag("type", event.type())
                .register(registry)
                .increment();
    }
}
