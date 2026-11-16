package com.example.categoryservice.service;

import com.example.categoryservice.model.Category;
import com.example.categoryservice.repository.CategoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
public class CategoryService {

    private final CategoryRepository repository;

    public CategoryService(CategoryRepository repository) {
        this.repository = repository;
    }

    public List<Category> list(String owner) {
        return repository.findByOwner(owner);
    }

    public Optional<Category> get(Long id, String owner) {
        return repository.findByIdAndOwner(id, owner);
    }

    public Category create(Category category, String owner) {
        if (repository.existsByOwnerAndName(owner, category.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu isimde bir kategori zaten var");
        }
        category.setId(null);          // istemci id göndermiş olsa bile yeni kayıt oluştur
        category.setOwner(owner);
        return repository.save(category);
    }

    public Optional<Category> rename(Long id, String newName, String owner) {
        return repository.findByIdAndOwner(id, owner).map(existing -> {
            if (!existing.getName().equals(newName) && repository.existsByOwnerAndName(owner, newName)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu isimde bir kategori zaten var");
            }
            existing.setName(newName);
            return repository.save(existing);
        });
    }

    public boolean delete(Long id, String owner) {
        return repository.findByIdAndOwner(id, owner).map(c -> {
            repository.delete(c);
            return true;
        }).orElse(false);
    }
}
