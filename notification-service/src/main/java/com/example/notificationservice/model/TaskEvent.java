package com.example.notificationservice.model;

// Task Service'in yayınladığı olayın aynısı (JSON olarak taşınır)
public record TaskEvent(
        String eventId,
        String type,        // task.created | task.completed | task.deleted
        Long taskId,
        String owner,
        String title,
        String occurredAt) {
}
