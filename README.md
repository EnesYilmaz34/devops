# Advanced Task App — Mikroservis Mimarisi

JWT ile korunan, PostgreSQL kullanan, Docker ve Kubernetes'e hazır bir mikroservis sistemi.

## Mimari

```
Client → API Gateway (8080) → User Service (8081)  → user-db (PostgreSQL)
                             → Task Service (8082) → task-db (PostgreSQL)
```

- **user-service**: Kayıt/giriş, şifreleri BCrypt ile hash'ler, JWT üretir
- **task-service**: Görev CRUD işlemleri, gelen JWT'yi doğrular, her kullanıcı sadece kendi görevlerini görür
- **api-gateway**: Dışarıya tek kapı, `/api/auth/**` → user-service, `/api/tasks/**` → task-service

## Yerelde Çalıştırma (Docker Compose)

Tek komutla her şeyi ayağa kaldır (2 servis + 2 veritabanı + gateway):

```bash
docker-compose up --build
```

Her şey hazır olduğunda:
- Gateway: `http://localhost:8080`
- User Service (direkt): `http://localhost:8081`
- Task Service (direkt): `http://localhost:8082`

## Uçtan Uca Test Senaryosu

**1. Kayıt ol** (gateway üzerinden):
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ahmet","email":"ahmet@example.com","password":"sifre123"}'
```
Cevapta bir `token` gelecek — bir sonraki adımlarda bunu kullanacağız.

**2. Giriş yap** (token'ı tekrar almak istersen):
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ahmet","password":"sifre123"}'
```

**3. Token ile görev oluştur:**
```bash
TOKEN="yukarıda_aldığın_token"

curl -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Sütü al","description":"Yarım yağlı"}'
```

**4. Görevleri listele:**
```bash
curl http://localhost:8080/api/tasks -H "Authorization: Bearer $TOKEN"
```

Token olmadan `/api/tasks` çağırırsan `401 Unauthorized` alırsın — güvenlik katmanı çalışıyor demektir.

## Kubernetes'e Deploy Etme

```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/user-service.yaml
kubectl apply -f k8s/task-service.yaml
kubectl apply -f k8s/api-gateway.yaml
```

Not: `k8s/user-service.yaml` ve `k8s/task-service.yaml` içindeki `kullaniciadi/...` imaj adlarını
kendi Docker Hub kullanıcı adınla değiştirmen gerekir. İmajları önce build edip push et:

```bash
docker build -t kullaniciadi/user-service:latest ./user-service
docker push kullaniciadi/user-service:latest
# task-service ve api-gateway için de aynısını yap
```

## CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml` şunları yapar:
1. Her 3 servisi paralel olarak test eder (matrix strategy)
2. Testler geçerse Docker imajlarını build edip Docker Hub'a push eder
3. Son olarak Kubernetes'e deploy eder

Kullanmak için repo Settings → Secrets kısmına şunları eklemen gerekir:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Güvenlik Notları

- Şifreler asla düz metin saklanmaz (BCrypt hash)
- JWT secret'ı kod içine gömülü değil, environment variable / Kubernetes Secret'tan geliyor
- `task-service`, her isteği doğrulanmış JWT olmadan reddediyor (401)
- Her kullanıcı sadece kendi `owner` alanına sahip görevleri görebiliyor/silebiliyor

## Sırada Ne Var? (İleri Seviye Fikirler)

- Servisler arası iletişim için **Service Discovery** (Eureka) veya **Consul**
- **Refresh token** mekanizması (şu an JWT süresi dolunca yeniden login gerekiyor)
- **Rate limiting** (API Gateway seviyesinde, örn. Redis ile)
- **Event-driven mimari**: Kafka/RabbitMQ ile servisler arası asenkron iletişim
- **Centralized logging**: ELK stack veya Loki
- **Circuit breaker** (Resilience4j) — bir servis çökerse sistemin tamamen durmaması için

## Distributed Tracing (OpenTelemetry + Jaeger)

Sisteme **OpenTelemetry** eklendi — bir isteğin API Gateway'den User/Task Service'e,
oradan veritabanına kadar tüm yolculuğunu ve her adımda ne kadar sürdüğünü görebilirsin.

### Nasıl çalışıyor

Her servisin Dockerfile'ına OpenTelemetry Java agent'ı eklendi (`-javaagent` ile).
Kod hiç değişmedi — agent, HTTP isteklerini ve JPA/veritabanı sorgularını otomatik
yakalayıp **Jaeger**'a gönderiyor.

### Docker Compose ile görüntüleme

```bash
docker-compose up --build
```

Birkaç istek at (register, login, task oluştur), sonra tarayıcıda aç:
```
http://localhost:16686
```

Sol üstteki **Service** dropdown'ından `api-gateway`, `user-service` veya `task-service`
seç, **Find Traces**'e bas. Bir trace'e tıkladığında, isteğin hangi servislerden geçtiğini
ve her adımın süresini gösteren bir zaman çizelgesi (Gantt chart benzeri) göreceksin.

### Kubernetes'te görüntüleme

```bash
kubectl apply -f k8s/jaeger.yaml
kubectl rollout restart deployment/user-service deployment/task-service deployment/api-gateway
```

Jaeger UI'a erişmek için port-forward:
```bash
kubectl port-forward service/jaeger 16686:16686
```
Tarayıcıda: `http://localhost:16686`

### CLI ile kontrol (tarayıcıya gitmeden)

`tracectl/` klasöründe, terminalden trace ve log kontrolü yapan küçük bir araç var:

```bash
cd tracectl
npm install && npm link

tracectl services                          # hangi servisler trace gönderiyor
tracectl traces --service task-service      # son trace'ler
tracectl traces --service task-service --errors-only
tracectl trace <traceID>                    # bir trace'in detaylı yolculuğu
tracectl logs --service task-service        # canlı log takibi
```

Detaylar için `tracectl/README.md`.

## Metrics (Prometheus) ve Log Toplama (Loki)

**Prometheus** — istek sayısı, gecikme, hata oranı, JVM bellek kullanımı gibi
zaman içindeki metrikleri toplar. Her Spring Boot servisi `/actuator/prometheus`
endpoint'inden metrik yayınlıyor, Prometheus bunları 10 saniyede bir topluyor.

**Loki** — tüm servislerin (ve Docker container'larının) loglarını tek yerde
toplar, Grafana'dan LogQL ile sorgulanabilir hale getirir.

### Docker Compose ile

```bash
docker-compose up --build
```

- Prometheus UI: `http://localhost:9090` (Status → Targets'tan servislerin
  taranıp taranmadığını görebilirsin)
- Grafana: `http://localhost:3001` → sol menü **Explore** → data source olarak
  **Prometheus** veya **Loki** seç

Örnek Prometheus sorgusu (Grafana Explore veya `localhost:9090`'da):
```
rate(http_server_requests_seconds_count{application="task-service"}[1m])
```

Örnek Loki sorgusu (LogQL):
```
{service="advanced-task-app-task-service-1"} |= "ERROR"
```

### Kubernetes ile

```bash
kubectl apply -f k8s/prometheus.yaml
kubectl apply -f k8s/loki.yaml
kubectl apply -f k8s/promtail.yaml
```

Servisleri yeni `/actuator/prometheus` endpoint'iyle güncellemek için CI/CD'yi
tetikle (commit+push), sonra:
```bash
kubectl rollout restart deployment/user-service deployment/task-service deployment/api-gateway
```

Prometheus'a erişmek için:
```bash
kubectl port-forward service/prometheus 9090:9090
```

