package com.example.taskservice.controller;

import com.example.taskservice.model.Task;
import com.example.taskservice.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // JWT filter, doğrulanmış username'i Authentication içine koyuyor
    private String currentUser(Authentication authentication) {
        return authentication.getName();
    }

    @GetMapping
    public List<Task> getAllTasks(Authentication authentication) {
        return taskService.getTasksForUser(currentUser(authentication));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id, Authentication authentication) {
        return taskService.getTaskByIdForUser(id, currentUser(authentication))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Task> createTask(@Valid @RequestBody Task task, Authentication authentication) {
        Task saved = taskService.createTask(task, currentUser(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @Valid @RequestBody Task task,
                                            Authentication authentication) {
        return taskService.updateTask(id, task, currentUser(authentication))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id, Authentication authentication) {
        boolean deleted = taskService.deleteTask(id, currentUser(authentication));
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
