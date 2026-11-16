package com.example.categoryservice.repository;

import com.example.categoryservice.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByOwner(String owner);
    Optional<Category> findByIdAndOwner(Long id, String owner);
    boolean existsByOwnerAndName(String owner, String name);
}
