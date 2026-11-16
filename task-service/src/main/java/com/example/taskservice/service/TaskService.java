package com.example.taskservice.service;

import com.example.taskservice.client.CategoryClient;
import com.example.taskservice.messaging.TaskEventPublisher;
import com.example.taskservice.model.Task;
import com.example.taskservice.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final TaskEventPublisher eventPublisher;
    private final CategoryClient categoryClient;

    public TaskService(TaskRepository taskRepository, TaskEventPublisher eventPublisher,
                       CategoryClient categoryClient) {
        this.taskRepository = taskRepository;
        this.eventPublisher = eventPublisher;
        this.categoryClient = categoryClient;
    }

    public List<Task> getTasksForUser(String owner) {
        return taskRepository.findByOwner(owner);
    }

    public Optional<Task> getTaskByIdForUser(Long id, String owner) {
        return taskRepository.findByIdAndOwner(id, owner);
    }

    public Task createTask(Task task, String owner, String authHeader) {
        if (task.getCategoryId() != null) {
            categoryClient.ensureCategoryExists(task.getCategoryId(), authHeader);   // senkron REST
        }
        task.setId(null);              // istemci id göndermiş olsa bile yeni kayıt oluştur
        task.setOwner(owner);
        Task saved = taskRepository.save(task);
        eventPublisher.publish("task.created", saved);                               // asenkron olay
        return saved;
    }

    public Optional<Task> updateTask(Long id, Task updatedTask, String owner, String authHeader) {
        return taskRepository.findByIdAndOwner(id, owner).map(existing -> {
            boolean wasCompleted = existing.isCompleted();

            if (updatedTask.getCategoryId() != null
                    && !Objects.equals(updatedTask.getCategoryId(), existing.getCategoryId())) {
                categoryClient.ensureCategoryExists(updatedTask.getCategoryId(), authHeader);
            }
            existing.setTitle(updatedTask.getTitle());
            existing.setDescription(updatedTask.getDescription());
            existing.setCompleted(updatedTask.isCompleted());
            existing.setCategoryId(updatedTask.getCategoryId());
            Task saved = taskRepository.save(existing);

            if (!wasCompleted && saved.isCompleted()) {
                eventPublisher.publish("task.completed", saved);
            }
            return saved;
        });
    }

    public boolean deleteTask(Long id, String owner) {
        return taskRepository.findByIdAndOwner(id, owner).map(task -> {
            taskRepository.delete(task);
            eventPublisher.publish("task.deleted", task);
            return true;
        }).orElse(false);
    }
}
