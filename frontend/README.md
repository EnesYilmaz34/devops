# Defter — Task App Frontend

Next.js (App Router) + TypeScript + Tailwind. API Gateway üzerinden `user-service` ve
`task-service`'e istek atar.

## Kurulum

```bash
cd frontend
npm install
```

## Çalıştırma (lokal geliştirme)

Önce backend'in ayakta olduğundan emin ol — API Gateway `localhost:8080`'de dinliyor olmalı:

```bash
kubectl port-forward service/api-gateway 8080:8080
```

Sonra, ayrı bir terminalde frontend'i başlat:

```bash
npm run dev
```

Tarayıcıda aç: `http://localhost:3000`

## Akış

1. `/register` sayfasında kayıt ol → otomatik JWT alınıp tarayıcıda saklanır
2. `/tasks` sayfasına yönlendirilirsin, görev ekleyip/tamamlayıp/silebilirsin
3. Her istek `Authorization: Bearer <token>` header'ıyla API Gateway'e gider
4. Gateway isteği `task-service`'e yönlendirir, orada JWT doğrulanır

## Farklı bir API adresi kullanmak istersen

```bash
cp .env.local.example .env.local
# .env.local içindeki NEXT_PUBLIC_API_URL değerini değiştir
```

## Production build

```bash
npm run build
npm run start
```

## Notlar

- JWT `localStorage`'da saklanıyor (basit bir demo için yeterli; gerçek production'da
  `httpOnly` cookie + refresh token akışı daha güvenli olur)
- API Gateway'de CORS, `http://localhost:3000` origin'ine izin verecek şekilde ayarlandı
  (`api-gateway/src/main/resources/application.yml`)
