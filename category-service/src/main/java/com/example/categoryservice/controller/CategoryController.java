package com.example.categoryservice.controller;

import com.example.categoryservice.model.Category;
import com.example.categoryservice.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService service;

    public CategoryController(CategoryService service) {
        this.service = service;
    }

    @GetMapping
    public List<Category> list(Authentication auth) {
        return service.list(auth.getName());
    }

    // Task Service, bir kategorinin var olup olmadığını bu uçla doğrular
    @GetMapping("/{id}")
    public ResponseEntity<Category> get(@PathVariable Long id, Authentication auth) {
        return service.get(id, auth.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Category> create(@Valid @RequestBody Category category, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(category, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> rename(@PathVariable Long id, @Valid @RequestBody Category category,
                                           Authentication auth) {
        return service.rename(id, category.getName(), auth.getName())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        return service.delete(id, auth.getName())
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
