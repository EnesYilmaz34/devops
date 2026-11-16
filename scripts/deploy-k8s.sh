#!/usr/bin/env bash
# Yerel Kubernetes cluster'ına (Docker Desktop / Minikube) tüm sistemi deploy eder.
# Kullanım:   ./scripts/deploy-k8s.sh            (ilk kurulum veya manifest güncelleme)
#             RESTART=1 ./scripts/deploy-k8s.sh  (Docker Hub'a yeni imaj gittikten sonra pod'ları yenile)
set -euo pipefail
cd "$(dirname "$0")/../k8s"

echo ">> Cluster kontrol ediliyor..."
kubectl get nodes

echo ">> Secret ve ConfigMap uygulanıyor..."
kubectl apply -f secret.yaml -f configmap.yaml

echo ">> Altyapı (veritabanları, RabbitMQ, gözlemlenebilirlik) uygulanıyor..."
kubectl apply -f postgres.yaml -f rabbitmq.yaml -f jaeger.yaml -f loki.yaml \
              -f prometheus.yaml -f grafana.yaml -f promtail.yaml

echo ">> Veritabanları ve RabbitMQ'nun hazır olması bekleniyor..."
for d in users-db tasks-db categories-db rabbitmq; do
  kubectl rollout status deployment/$d --timeout=300s
done

echo ">> Mikroservisler uygulanıyor..."
kubectl apply -f user-service.yaml -f category-service.yaml -f task-service.yaml \
              -f notification-service.yaml -f api-gateway.yaml

SERVICES="user-service category-service task-service notification-service api-gateway"
if [ "${RESTART:-0}" = "1" ]; then
  for d in $SERVICES; do kubectl rollout restart deployment/$d; done
fi
for d in $SERVICES; do
  kubectl rollout status deployment/$d --timeout=420s
done

cat <<MSG

Hazır. Şimdi (her biri AYRI terminal sekmesinde) port-forward başlat:
  kubectl port-forward service/api-gateway 8080:8080
  kubectl port-forward service/jaeger      16686:16686
  kubectl port-forward service/prometheus  9090:9090
  kubectl port-forward service/grafana     3001:3000
  kubectl port-forward service/rabbitmq    15672:15672

NOT: 'rollout restart' sonrası port-forward bağlantısı kopar; komutu yeniden çalıştır.
Test için:  ./scripts/smoke-test.sh
MSG
