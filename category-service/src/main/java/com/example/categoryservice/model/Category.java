package com.example.categoryservice.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

// Her kullanıcı için kategori adı benzersizdir (owner + name)
@Entity
@Table(name = "category", uniqueConstraints = @UniqueConstraint(columnNames = {"owner", "name"}))
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Kategori adı boş olamaz")
    private String name;

    // JWT'den gelen kullanıcı adı
    private String owner;

    public Category() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
}
