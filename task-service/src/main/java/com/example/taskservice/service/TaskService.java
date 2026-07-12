package com.example.taskservice.service;

import com.example.taskservice.model.Task;
import com.example.taskservice.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public List<Task> getTasksForUser(String owner) {
        return taskRepository.findByOwner(owner);
    }

    public Optional<Task> getTaskByIdForUser(Long id, String owner) {
        return taskRepository.findByIdAndOwner(id, owner);
    }

    public Task createTask(Task task, String owner) {
        task.setOwner(owner);
        return taskRepository.save(task);
    }

    public Optional<Task> updateTask(Long id, Task updatedTask, String owner) {
        return taskRepository.findByIdAndOwner(id, owner).map(existingTask -> {
            existingTask.setTitle(updatedTask.getTitle());
            existingTask.setDescription(updatedTask.getDescription());
            existingTask.setCompleted(updatedTask.isCompleted());
            return taskRepository.save(existingTask);
        });
    }

    public boolean deleteTask(Long id, String owner) {
        return taskRepository.findByIdAndOwner(id, owner).map(task -> {
            taskRepository.delete(task);
            return true;
        }).orElse(false);
    }
}
