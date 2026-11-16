package com.example.taskservice.messaging;

// RabbitMQ'ya JSON olarak yayınlanan olay. Notification Service aynı alanları okur.
public record TaskEvent(
        String eventId,     // her olay için benzersiz (tüketici tekrarları bununla yok sayar)
        String type,        // task.created | task.completed | task.deleted
        Long taskId,
        String owner,
        String title,
        String occurredAt) {
}
