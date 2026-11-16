#!/usr/bin/env bash
# Uçtan uca duman testi: kayıt -> kategori -> görev -> güncelleme -> hata senaryoları.
# Kullanım:  ./scripts/smoke-test.sh            (varsayılan: http://localhost:8080)
#            BASE_URL=http://localhost:8080 ./scripts/smoke-test.sh
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:8080}"
USER_NAME="smoke$RANDOM"
PASS=0; FAIL=0

check() {  # check "açıklama" beklenen_kod gerçek_kod
  if [ "$2" = "$3" ]; then echo "  [OK]   $1 (HTTP $3)"; PASS=$((PASS+1));
  else echo "  [FAIL] $1 (beklenen $2, gelen $3)"; FAIL=$((FAIL+1)); fi
}

echo "== Kayıt ve giriş =="
RESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER_NAME\",\"email\":\"$USER_NAME@example.com\",\"password\":\"sifre123\"}")
check "Kayıt" 201 "$(echo "$RESP" | tail -n1)"
TOKEN=$(echo "$RESP" | head -n1 | sed -E 's/.*"token":"([^"]+)".*/\1/')
[ -z "$TOKEN" ] && { echo "Token alınamadı, test durduruldu."; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"sifre123\"}")
check "Giriş" 200 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER_NAME\",\"password\":\"yanlis\"}")
check "Yanlış şifre reddedilir" 401 "$CODE"

echo "== Kategori =="
RESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/categories" -H 'Content-Type: application/json' -H "$AUTH" -d '{"name":"İş"}')
check "Kategori oluştur" 201 "$(echo "$RESP" | tail -n1)"
CAT_ID=$(echo "$RESP" | head -n1 | sed -E 's/.*"id":([0-9]+).*/\1/')
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/categories" -H 'Content-Type: application/json' -H "$AUTH" -d '{"name":"İş"}')
check "Aynı isimli kategori reddedilir" 409 "$CODE"

echo "== Görev (Category Service doğrulaması + RabbitMQ olayı) =="
RESP=$(curl -s -w '\n%{http_code}' -X POST "$BASE_URL/api/tasks" -H 'Content-Type: application/json' -H "$AUTH" \
  -d "{\"title\":\"Rapor yaz\",\"description\":\"smoke test\",\"categoryId\":$CAT_ID}")
check "Kategorili görev oluştur" 201 "$(echo "$RESP" | tail -n1)"
TASK_ID=$(echo "$RESP" | head -n1 | sed -E 's/.*"id":([0-9]+).*/\1/')
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/tasks" -H 'Content-Type: application/json' -H "$AUTH" \
  -d '{"title":"Olmayan kategori","categoryId":999999}')
check "Olmayan kategori reddedilir" 400 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/tasks" -H "$AUTH")
check "Görevleri listele" 200 "$CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE_URL/api/tasks/$TASK_ID" -H 'Content-Type: application/json' -H "$AUTH" \
  -d "{\"title\":\"Rapor yaz\",\"description\":\"tamam\",\"completed\":true,\"categoryId\":$CAT_ID}")
check "Görevi tamamla (task.completed olayı)" 200 "$CODE"

echo "== Güvenlik =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/tasks")
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then check "Token'sız istek reddedilir" "$CODE" "$CODE"; else check "Token'sız istek reddedilir" "401/403" "$CODE"; fi

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE_URL/api/tasks/$TASK_ID" -H "$AUTH")
check "Görevi sil (task.deleted olayı)" 204 "$CODE"

echo
echo "Sonuç: $PASS başarılı, $FAIL başarısız."
echo "Bildirimleri görmek için (Docker Compose):  docker-compose logs notification-service | grep NOTIFICATION"
echo "Kubernetes için:                            kubectl logs -l app=notification-service | grep NOTIFICATION"
[ "$FAIL" -eq 0 ]
