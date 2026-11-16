# Task & Event Management Platform

Spring Boot mikroservisleri + RabbitMQ + PostgreSQL + Docker + Kubernetes + GitHub Actions +
OpenTelemetry (Jaeger) + Prometheus + Loki + Grafana + Next.js arayüz + `tracectl` CLI.

## 1. Mimari

```
Tarayıcı (Next.js :3000)
   |  HTTP/JSON + Authorization: Bearer <JWT>
   v
API Gateway :8080
   |-- /api/auth/**       --> User Service     :8081 --> users-db      (PostgreSQL)
   |-- /api/tasks/**      --> Task Service     :8082 --> tasks-db      (PostgreSQL)
   |-- /api/categories/** --> Category Service :8084 --> categories-db (PostgreSQL)

Task Service --(senkron REST: kategori doğrula)--> Category Service
Task Service --(asenkron olay: task.created/completed/deleted)--> RabbitMQ
RabbitMQ --> Notification Service :8083   (3 deneme, sonra notification.dlq)

Gözlemlenebilirlik:
  tüm servisler --OTLP/HTTP :4318--> Jaeger          Prometheus --scrape--> servisler + RabbitMQ
  Promtail --> Loki                                  Grafana <-- Jaeger | Prometheus | Loki
  tracectl (CLI) --> Jaeger

Teslimat: GitHub --> GitHub Actions (matrix, 5 servis) --> Docker Hub --> Kubernetes
```

| Bileşen | Port | Not |
|---|---|---|
| API Gateway | 8080 | Tek giriş noktası, CORS |
| User Service | 8081 | Kayıt, giriş, JWT üretimi |
| Task Service | 8082 | Görev CRUD, olay yayınlar |
| Notification Service | 8083 | RabbitMQ tüketicisi (dışarıya açık API'si yok) |
| Category Service | 8084 | Kategori CRUD |
| RabbitMQ | 5672 / 15672 / 15692 | AMQP / yönetim arayüzü / Prometheus metrikleri |
| Jaeger / Prometheus / Grafana / Loki | 16686 / 9090 / 3001 / 3100 | Grafana Compose'ta 3001 (frontend 3000'i kullanır) |
| Frontend | 3000 | `npm run dev` |

> **Önemli:** Bu paketin kodunu ben yazdım ama bulunduğum ortamda Maven/internet olmadığı için
> **derleyip çalıştıramadım**. İlk `docker-compose up --build` sırasında bir derleme hatası çıkarsa
> hata metnini yapıştır, birlikte düzeltelim. Aşağıdaki adımlar en olası sorunları da kapsıyor.

---

## 2. Ön koşullar

```bash
docker --version && docker-compose --version    # Docker Desktop AÇIK olmalı
git --version
node --version                                  # 18+ (frontend ve tracectl için)
kubectl version --client                        # sadece Kubernetes adımı için
```

Docker Desktop → Settings → Resources: **en az 6 GB (tercihen 8 GB) RAM** ver. Sistemde 5 servis,
3 veritabanı, RabbitMQ ve 5 gözlemlenebilirlik bileşeni var.

Önce 5432/5672/8080 gibi portlarda eski container kalmadığından emin ol:
```bash
docker ps          # eski projelerden kalanlar varsa: docker stop <ad>
```

---

## 3. YOL A — Docker Compose ile çalıştır (önce bunu yap)

### Adım 1: Projeyi aç
```bash
unzip advanced-task-app.zip
cd advanced-task-app
```

### Adım 2: Hepsini ayağa kaldır
```bash
docker-compose up --build
```
İlk seferde 5–10 dk sürer (Maven bağımlılıkları + OpenTelemetry agent iniyor). Terminal loglarla
dolacak, **kapatma**. `Started ... Application` satırlarını 5 serviste de görünce hazırdır.

### Adım 3: Her şeyin ayakta olduğunu doğrula (yeni terminal sekmesi)
```bash
docker ps
```
Şunların hepsi **Up** olmalı: `api-gateway`, `user-service`, `task-service`, `category-service`,
`notification-service`, `rabbitmq`, `users-db`, `tasks-db`, `categories-db`, `jaeger`, `prometheus`,
`loki`, `promtail`, `grafana`.

### Adım 4: Uçtan uca duman testi
```bash
./scripts/smoke-test.sh
```
Kayıt → giriş → kategori → kategorili görev → tamamlama → hata senaryolarını çalıştırır ve her
adım için `[OK]` / `[FAIL]` basar. Hepsi `[OK]` ise sistem çalışıyor demektir.

Elle denemek istersen:
```bash
curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"ahmet","email":"ahmet@example.com","password":"sifre123"}'
TOKEN="<dönen token>"

curl -X POST http://localhost:8080/api/categories -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"name":"İş"}'

curl -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"title":"Rapor yaz","categoryId":1}'
```

### Adım 5: Bildirimi gör (asenkron akışın kanıtı)
```bash
docker-compose logs notification-service | grep NOTIFICATION
```
Görev oluşturunca `NOTIFICATION to=ahmet type=task.created ...` satırı çıkar. Görev API'si bildirimi
**beklemeden** döner; bildirim RabbitMQ üzerinden arkada işlenir.

### Adım 6: Dead-letter queue (DLQ) denemesi
Başlığında `FAIL` geçen görev, bildirim servisinde bilerek hata üretir (test düzeneği):
```bash
curl -X POST http://localhost:8080/api/tasks -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"title":"FAIL deneme"}'
```
~3 saniye sonra mesaj 3 denemenin ardından `notification.dlq` kuyruğuna düşer:
```bash
docker-compose exec rabbitmq rabbitmqctl list_queues name messages
```
veya tarayıcıda `http://localhost:15672` (kullanıcı **taskapp** / şifre **taskapp123**) → Queues.

### Adım 7: Dayanıklılık deneyleri
**a) Bildirim servisi çökerse olaylar kaybolmaz:**
```bash
docker-compose stop notification-service
# 3 tane görev oluştur; RabbitMQ UI'da notification.queue "Ready" = 3 görünür
docker-compose start notification-service
docker-compose logs notification-service | grep NOTIFICATION     # 3 bildirim işlenir
```
**b) RabbitMQ çökerse görev API'si çalışmaya devam eder:**
```bash
docker-compose stop rabbitmq
# görev oluşturmaya devam et: hâlâ 201 döner
# Prometheus'ta task_events_publish_failures_total artar
docker-compose start rabbitmq
```
> Sınırlama: broker kapalıyken üretilen olaylar **tamponlanmaz**, kaybolur (sayaçla görünür).
> Bunu çözmek için "outbox" deseni gerekir; bu, geliştirme listesindedir.

### Adım 8: Gözlemlenebilirlik — trace, metrik, log

| Ne | Nerede | Nasıl |
|---|---|---|
| **Trace** | http://localhost:16686 | Service: `api-gateway` → Find Traces → bir `POST /api/tasks` trace'ini aç. Gateway → task-service → category-service ve RabbitMQ yayın/tüketim adımlarını görmelisin |
| **Metrik** | http://localhost:9090 | Status → Targets: 6 hedef de **UP** olmalı. Sorgular aşağıda |
| **Log** | http://localhost:3001 (Grafana) | Explore → **Loki** → `{service=~".*notification-service.*"} \|= "NOTIFICATION"` |
| **Hepsi** | http://localhost:3001 | Explore → Jaeger / Prometheus / Loki |

Örnek Prometheus sorguları:
```
sum by (application) (rate(http_server_requests_seconds_count[1m]))
notifications_sent_total
task_events_publish_failures_total
rabbitmq_queue_messages_ready
```
Bir trace ID'yi terminalden de inceleyebilirsin (bkz. Adım 10).

### Adım 9: Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```
(Gateway `localhost:8080`'de çalışıyor olmalı. Şu an arayüz görev ekranını destekliyor;
kategori/bildirim ekranları geliştirme listesinde.)

### Adım 10: tracectl (terminalden trace/log)
```bash
cd tracectl && npm install
node src/index.js services
node src/index.js traces --service task-service
node src/index.js trace <traceID>
node src/index.js logs --service notification-service
```
(`sudo npm link` ile `tracectl` komutunu global yapabilirsin.)

### Adım 11: Durdur / temizle
```bash
docker-compose down          # durdur (veriler kalır)
docker-compose down -v       # durdur ve tüm verileri sil
```

---

## 4. YOL B — GitHub'a yükle

> **Dikkat:** `git init` **proje klasörünün içinde** yapılmalı. Home veya Downloads'ta yaparsan
> bilgisayarındaki tüm dosyaları takip eder (daha önce yaşadık).

```bash
cd advanced-task-app
git rev-parse --show-toplevel        # çıktı advanced-task-app klasörünü göstermeli; değilse DUR
git init
git add .
git status                           # sadece proje dosyaları görünmeli
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<GITHUB_KULLANICI_ADIN>/<REPO_ADI>.git
git push -u origin main
```
GitHub şifre yerine **Personal Access Token** ister (Settings → Developer settings → Tokens (classic) → `repo`).
Repo'yu GitHub'da **boş** oluştur (README/gitignore ekleme).

---

## 5. YOL C — CI/CD (GitHub Actions → Docker Hub)

1. Docker Hub → Account Settings → Security → **New Access Token**, yetki: **Read & Write**
   (Read-only olursa `access token has insufficient scopes` hatası alırsın).
2. GitHub repo → Settings → Secrets and variables → Actions → şu secret'ları ekle:
   - `DOCKERHUB_USERNAME` (Docker Hub kullanıcı adın)
   - `DOCKERHUB_TOKEN` (az önceki token)
   - *(opsiyonel)* `KUBE_CONFIG`: sadece **internetten erişilebilir** bir cluster'ın kubeconfig'i.
     Yerel cluster için gerek yok.
3. `git push` yap → GitHub → **Actions** sekmesi. 5 servis paralel derlenir (`build-and-test`),
   sonra `docker-build-push` imajları `latest` ve commit-SHA etiketiyle Docker Hub'a yollar.
4. https://hub.docker.com → imajların ve **public** olduklarının kontrolü (private ise Kubernetes çekemez).

Not: `deploy` job'u `KUBE_CONFIG` yoksa kendini atlar. Yerel cluster'a deploy için Adım 6'daki betik kullanılır.

---

## 6. YOL D — Kubernetes'e deploy (yerel cluster)

### Adım 1: Cluster hazır mı?
```bash
kubectl get nodes          # Ready bir node görmelisin
```
Docker Desktop → Settings → Kubernetes → Enable (takılırsa: Reset cluster / Minikube: `minikube start`).

### Adım 2: İmaj sahibini kendi Docker Hub adınla eşle
Manifest'lerde imajlar `bnjmn034/<servis>:latest`. Farklıysa:
```bash
sed -i '' 's#bnjmn034/#SENIN_DOCKERHUB_ADIN/#g' k8s/*-service.yaml k8s/api-gateway.yaml     # macOS
# Linux:  sed -i 's#bnjmn034/#SENIN_DOCKERHUB_ADIN/#g' k8s/*-service.yaml k8s/api-gateway.yaml
```
İmajlar Docker Hub'da olmalı (Bölüm 5 veya elle `docker build` + `docker push`).

### Adım 3: Deploy
```bash
./scripts/deploy-k8s.sh
```
Betik sırayla: Secret/ConfigMap → veritabanları + RabbitMQ + gözlemlenebilirlik → mikroservisler →
`rollout status` ile bekler. Bittiğinde `kubectl get pods` ile hepsinin `1/1 Running` olduğunu gör.

RAM yetmezse replikaları azalt:
```bash
for d in user-service task-service category-service notification-service api-gateway; do
  kubectl scale deployment/$d --replicas=1; done
```

### Adım 4: Port-forward (her biri AYRI terminal sekmesi)
```bash
kubectl port-forward service/api-gateway 8080:8080
kubectl port-forward service/jaeger      16686:16686
kubectl port-forward service/prometheus  9090:9090
kubectl port-forward service/grafana     3001:3000
kubectl port-forward service/rabbitmq    15672:15672
```

### Adım 5: Test
```bash
./scripts/smoke-test.sh
kubectl logs -l app=notification-service | grep NOTIFICATION
```

### Adım 6: Kod değişince
```bash
git push                                   # CI imajları Docker Hub'a gönderir (Actions yeşil olmalı)
RESTART=1 ./scripts/deploy-k8s.sh          # pod'ları yeni imajla yeniler
# ardından port-forward komutlarını YENİDEN başlat (restart bağlantıyı koparır)
```

---

## 7. Sık karşılaşılan sorunlar

| Belirti | Neden | Çözüm |
|---|---|---|
| `port is already allocated` / `address already in use` | Eski container aynı portu tutuyor | `docker ps` → `docker stop <ad>` |
| Tarayıcıda CORS hatası, OPTIONS 403 | Gateway pod'u eski imajla çalışıyor | `docker pull`/`imagePullPolicy: Always`, pod'u yeniden yarat, port-forward'u yeniden başlat |
| Jaeger'da trace yok; log'da `bogus greeting` | OTLP HTTP verisi gRPC portuna (4317) gidiyor | Endpoint `http://jaeger:4318/v1/traces` + `http/protobuf` (bu pakette doğru) |
| `ErrImagePull` / `ImagePullBackOff` | İmaj adı yanlış, push edilmemiş veya repo private | İmaj adını düzelt, push et, repo'yu public yap |
| CI: `access token has insufficient scopes` | Docker Hub token'ı read-only | Read & Write token oluştur, secret'ı güncelle |
| `rollout restart` sonrası API'ye ulaşılamıyor | port-forward eski pod'a bağlıydı | Rollout bitince port-forward'u yeniden başlat |
| Docker Desktop Kubernetes "Starting"de takılı | Ağ/VPN/kaynak sorunu | VPN kapat, Reset cluster, ya da Minikube |
| `fatal: No configured push destination` / `git status` binlerce dosya | Yanlış klasörde `git init` / remote yok | Bölüm 4'e bak |
| Loki'de k8s logları ham JSON görünüyor | Cluster Docker log biçimi kullanıyor | `k8s/promtail.yaml` içinde `cri: {}` yerine `docker: {}` yaz |
| Görev oluşturma `503` veriyor | Category Service ayakta değil (kategori verdiysen) | `kubectl get pods` / `docker ps` ile kontrol et |

---

## 8. Proje yapısı

```
advanced-task-app/
├── api-gateway/  user-service/  task-service/  category-service/  notification-service/
├── frontend/         Next.js arayüz
├── tracectl/         terminal aracı (trace/log)
├── k8s/              Kubernetes manifest'leri (ConfigMap, Secret, PVC'li DB'ler, RabbitMQ, servisler, gözlemlenebilirlik)
├── prometheus/ loki/ promtail/ grafana/ rabbitmq/    Compose yapılandırmaları
├── scripts/          deploy-k8s.sh, smoke-test.sh
├── .github/workflows/ci-cd.yml
└── docker-compose.yml
```

## 9. Bilinen sınırlamalar ve yapılacaklar

- **Otomatik test yok** (CI'da `mvn verify` sadece derler). Sıradaki iş: JUnit 5 + Testcontainers.
- Broker kapalıyken üretilen olaylar tamponlanmaz (outbox deseni gerekir).
- Kategori silinince o kategorideki görevler güncellenmez (olay tabanlı çözüm planlı).
- Refresh token, rate limiting, circuit breaker, RBAC henüz yok.
- Grafana'da hazır dashboard ve alert kuralları yok (yalnızca 3 veri kaynağı tanımlı).
- Demo şifreleri (`JWT_SECRET`, DB şifreleri) dosyalarda düz yazı; üretimde Secret yöneticisi kullanılmalı.
- Frontend'de kategori ve bildirim ekranları yok.
- JWT HMAC (simetrik) imzalı ve tüm servisler aynı secret'ı paylaşır.
