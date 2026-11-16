package com.example.taskservice.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/** Category Service'e senkron (REST) çağrı: kategori gerçekten var mı ve bu kullanıcıya mı ait? */
@Component
public class CategoryClient {

    private final RestClient restClient;

    public CategoryClient(@Value("${category.service.url}") String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);   // servis yanıt vermezse isteği asılı bırakma
        factory.setReadTimeout(2000);
        this.restClient = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public void ensureCategoryExists(Long categoryId, String authorizationHeader) {
        try {
            restClient.get()
                    .uri("/api/categories/{id}", categoryId)
                    .headers(h -> {
                        if (authorizationHeader != null) {
                            h.set(HttpHeaders.AUTHORIZATION, authorizationHeader);
                        }
                    })
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpClientErrorException.NotFound e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kategori bulunamadı: " + categoryId);
        } catch (HttpClientErrorException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Kategori doğrulanamadı");
        } catch (RestClientException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Category Service şu an kullanılamıyor");
        }
    }
}
