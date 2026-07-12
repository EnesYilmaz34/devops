# tracectl

Terminalden Jaeger/OpenTelemetry trace'lerini ve servis loglarını kontrol etmek için
küçük bir CLI aracı. Jaeger'ın HTTP API'sini kullanır, Grafana/tarayıcıya gitmeden
hızlı kontrol yapmanı sağlar.

## Kurulum

```bash
cd tracectl
npm install
npm link
```

`npm link` komutu `tracectl` komutunu global olarak PATH'ine ekler. Artık projenin
her yerinden `tracectl` yazarak çalıştırabilirsin.

(`npm link` çalışmazsa veya global kurulum istemiyorsan, `node src/index.js <komut>`
şeklinde de kullanabilirsin.)

## Gereksinim

Jaeger'ın erişilebilir olması lazım — `docker-compose up` ile lokal çalıştırdıysan
`http://localhost:16686` zaten hazırdır. Kubernetes kullanıyorsan önce:

```bash
kubectl port-forward service/jaeger 16686:16686
```

Farklı bir adres kullanıyorsan:
```bash
JAEGER_URL=http://baska-adres:16686 tracectl services
```

## Komutlar

### Hangi servisler trace gönderiyor?

```bash
tracectl services
```

### Bir servisin son trace'lerini listele

```bash
tracectl traces --service api-gateway
tracectl traces --service task-service --limit 20
tracectl traces --service task-service --errors-only
```

Çıktı örneği:
```
  ✓ OK  a1b2c3d4e5f6  POST /api/tasks  42.3ms  (4 span)
  ✗ HATA  f6e5d4c3b2a1  GET /api/tasks  1204.5ms  (6 span)
```

### Bir trace'in tüm servisler arası yolculuğunu detaylı gör

```bash
tracectl trace a1b2c3d4e5f6
```

Çıktı, hangi servisten hangi servise geçtiğini, her adımın süresini ve varsa
hata mesajını zaman çizelgesi gibi gösterir.

### Canlı log takibi

Docker Compose ile:
```bash
tracectl logs --service task-service
```

Kubernetes ile:
```bash
tracectl logs --service task-service --k8s
```

Loglarda `ERROR`/`Exception` geçen satırlar kırmızı, `WARN` geçenler sarı renkte
gösterilir, taramak kolaylaşır.

## Tipik kullanım akışı

```bash
# 1. Frontend'den veya Postman'den birkaç istek at
# 2. Hangi servislerde trace var, gör
tracectl services

# 3. task-service'te yavaş/hatalı bir istek var mı bak
tracectl traces --service task-service --errors-only

# 4. Bulduğun trace ID'yi detaylı incele
tracectl trace <traceID>

# 5. Aynı anda o servisin canlı loglarını da izle
tracectl logs --service task-service
```
