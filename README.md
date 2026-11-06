# Microservices App

Arsitektur microservices dengan dua backend service (User Service dan Authentication Service), MySQL, Nginx sebagai API gateway/reverse proxy, centralized logging Fluent Bit, dan pipeline CI/CD GitHub Actions.

## Struktur Proyek

```text
microservices-app/
├── user-services/                  # User Service (Node.js/Express)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── db.js
│       └── routes/users.js
├── authentication-services/        # Authentication Service (Node.js/Express)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── db.js
│       └── routes/auth.js
├── nginx/
│   └── nginx.conf                  # Reverse proxy untuk routing /api/users & /api/auth
├── k8s/
│   ├── namespace.yaml
│   ├── app-configmap.yaml
│   ├── app-secret.yaml
│   ├── mysql-secret.yaml
│   ├── mysql-pvc.yaml
│   ├── mysql-initdb-configmap.yaml
│   ├── mysql-deployment.yaml
│   ├── mysql-service.yaml
│   ├── user-service-deployment.yaml
│   ├── user-service-service.yaml
│   ├── auth-service-deployment.yaml
│   ├── auth-service-service.yaml
│   ├── nginx-configmap.yaml
│   ├── nginx-proxy-deployment.yaml
│   ├── nginx-proxy-service.yaml
│   ├── ingress.yaml
│   ├── kustomization.yaml
│   └── logging/
│       ├── fluent-bit-rbac.yaml
│       ├── fluent-bit-configmap.yaml
│       └── fluent-bit-daemonset.yaml
├── .github/workflows/ci-cd.yml
├── .env.example
└── README.md
```

## Komponen

| Komponen | Image | Port | Deskripsi |
| --- | --- | --- | --- |
| MySQL | `mysql:8.0` | 3306 | Database `user_db` dan `auth_db`, data disimpan di PVC 5Gi |
| User Service | `microservices/user-service` | 3001 | CRUD user, terhubung ke `user_db` |
| Auth Service | `microservices/auth-service` | 3002 | Register, login, validasi JWT, terhubung ke `auth_db` |
| Nginx Proxy | `nginx:1.27-alpine` | 80 / NodePort 30080 | Gateway routing `/api/users` dan `/api/auth` |
| Fluent Bit | `fluent/fluent-bit:3.1.9` | 2020 | DaemonSet centralized logging ke stdout |

## Endpoint

Melalui Nginx (`http://<node-ip>:30080`):

| Method | Path | Deskripsi |
| --- | --- | --- |
| GET | `/api/users/health` | Health check User Service |
| GET | `/api/users` | List user |
| GET | `/api/users/:id` | Detail user |
| POST | `/api/users` | Buat user (`name`, `email`) |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Hapus user |
| GET | `/api/auth/health` | Health check Auth Service |
| POST | `/api/auth/register` | Register (`username`, `email`, `password`) |
| POST | `/api/auth/login` | Login (`username`, `password`) |
| POST | `/api/auth/validate` | Validasi token (`token` atau header `Authorization: Bearer ...`) |

## Prasyarat

- Docker dan Docker Buildx
- `kubectl`
- Minikube atau Kind (atau klaster Kubernetes lain)
- Akun GitHub dan akses ke GitHub Container Registry
- (Opsional) Ingress Controller Nginx untuk manifest `ingress.yaml`

## Menjalankan Secara Lokal dengan Docker

```bash
docker build -t microservices/user-service:latest ./user-services
docker build -t microservices/auth-service:latest ./authentication-services

docker network create microservices-net
docker run -d --name mysql --network microservices-net \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=user_db \
  -e MYSQL_USER=appuser \
  -e MYSQL_PASSWORD=apppassword \
  mysql:8.0

docker run -d --name user-service --network microservices-net -p 3001:3001 \
  -e DB_HOST=mysql -e DB_USER=appuser -e DB_PASSWORD=apppassword -e DB_NAME=user_db \
  microservices/user-service:latest

docker run -d --name auth-service --network microservices-net -p 3002:3002 \
  -e DB_HOST=mysql -e DB_USER=appuser -e DB_PASSWORD=apppassword -e DB_NAME=auth_db \
  -e JWT_SECRET=super-secret-jwt-key-change-in-production \
  microservices/auth-service:latest
```

Database `auth_db` perlu dibuat manual pada mode Docker lokal:

```bash
docker exec -it mysql mysql -uroot -prootpassword \
  -e "CREATE DATABASE IF NOT EXISTS auth_db; GRANT ALL PRIVILEGES ON auth_db.* TO 'appuser'@'%'; FLUSH PRIVILEGES;"
```

## Deploy ke Kubernetes (Minikube / Kind)

### 1. Build dan load image ke klaster lokal

```bash
docker build -t microservices/user-service:latest ./user-services
docker build -t microservices/auth-service:latest ./authentication-services

minikube image load microservices/user-service:latest
minikube image load microservices/auth-service:latest
```

Untuk Kind:

```bash
kind load docker-image microservices/user-service:latest
kind load docker-image microservices/auth-service:latest
```

### 2. Apply seluruh manifest

```bash
kubectl apply -k k8s/
```

Urutan manual (jika tidak memakai kustomize):

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/app-configmap.yaml -f k8s/app-secret.yaml
kubectl apply -f k8s/mysql-secret.yaml -f k8s/mysql-initdb-configmap.yaml
kubectl apply -f k8s/mysql-pvc.yaml -f k8s/mysql-deployment.yaml -f k8s/mysql-service.yaml
kubectl apply -f k8s/user-service-deployment.yaml -f k8s/user-service-service.yaml
kubectl apply -f k8s/auth-service-deployment.yaml -f k8s/auth-service-service.yaml
kubectl apply -f k8s/nginx-configmap.yaml -f k8s/nginx-proxy-deployment.yaml -f k8s/nginx-proxy-service.yaml
kubectl apply -f k8s/logging/
```

### 3. Verifikasi

```bash
kubectl get pods,svc -n microservices
kubectl rollout status deployment/mysql -n microservices

kubectl port-forward -n microservices svc/nginx-proxy 8080:80
curl http://localhost:8080/api/users/health
curl http://localhost:8080/api/auth/health
```

Atau dengan NodePort:

```bash
minikube service nginx-proxy -n microservices --url
curl http://<node-ip>:30080/api/users/health
```

Uji pembuatan data:

```bash
curl -X POST http://<node-ip>:30080/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi","email":"budi@example.com"}'

curl -X POST http://<node-ip>:30080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"budi","email":"budi@example.com","password":"secret123"}'

curl -X POST http://<node-ip>:30080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"budi","password":"secret123"}'
```

## Centralized Logging

Fluent Bit berjalan sebagai DaemonSet di namespace `microservices`, membaca log container dari `/var/log/containers`, menambahkan metadata Kubernetes (`pod_name`, `namespace_name`, `container_name`, labels), lalu mengirim ke stdout. Log milik Fluent Bit sendiri dikecualikan lewat `Exclude_Path` agar tidak terjadi feedback loop.

### 1. Cek komponen logging

```bash
kubectl get daemonset,pods -n microservices -l app=fluent-bit
kubectl describe daemonset fluent-bit -n microservices
```

### 2. Lihat log terpusat

```bash
# 100 baris terakhir dari semua container di node
kubectl logs -n microservices -l app=fluent-bit --tail=100

# Stream real-time
kubectl logs -n microservices -l app=fluent-bit -f
```

### 3. Filter log terpusat

PowerShell:

```powershell
# Hanya log dari namespace microservices
kubectl logs -n microservices -l app=fluent-bit --tail=500 | Select-String '"namespace_name":"microservices"'

# Hanya log user-service
kubectl logs -n microservices -l app=fluent-bit --tail=500 | Select-String '"service":"user-service"'

# Hanya request yang error
kubectl logs -n microservices -l app=fluent-bit --tail=500 | Select-String '"status":5'

# Request ke endpoint /api/users
kubectl logs -n microservices -l app=fluent-bit --tail=500 | Select-String '"path":"/api/users"'
```

Bash/Linux:

```bash
kubectl logs -n microservices -l app=fluent-bit --tail=500 | grep '"namespace_name":"microservices"'
kubectl logs -n microservices -l app=fluent-bit --tail=500 | grep '"status":5'
```

Dengan `jq` (field metadata berada di dalam objek `kubernetes`):

```bash
kubectl logs -n microservices -l app=fluent-bit --tail=500 \
  | jq -c 'select(.kubernetes.namespace_name == "microservices")'
```

### 4. Lihat log per service/pod

```bash
kubectl logs -n microservices deploy/user-service --tail=100
kubectl logs -n microservices deploy/auth-service --tail=100
kubectl logs -n microservices deploy/nginx-proxy --tail=100
kubectl logs -n microservices deploy/mysql --tail=100

# Stream real-time
kubectl logs -n microservices deploy/auth-service -f

# Pod tertentu
kubectl get pods -n microservices
kubectl logs -n microservices <nama-pod> --tail=100
```

### 5. Cek log akses Nginx

```bash
kubectl logs -n microservices deploy/nginx-proxy --tail=50
kubectl logs -n microservices deploy/nginx-proxy --tail=200 | Select-String 'api/users'
```

Contoh output:

```json
{"time":"2026-11-05T04:21:14+00:00","remote_addr":"192.168.65.3","request":"GET /api/users/health HTTP/1.1","status":200,"upstream_addr":"10.111.211.216:3001","upstream_status":"200"}
```

### 6. Test pipeline logging end-to-end

```bash
curl.exe -s -o NUL http://localhost:30080/api/users/health
curl.exe -s -o NUL http://localhost:30080/api/auth/health
timeout /t 5 >nul
kubectl logs -n microservices -l app=fluent-bit --tail=50 | Select-String '"service":"user-service"'
```

Jika log muncul di Fluent Bit dengan `kubernetes.pod_name` yang sesuai (bukan `fluent-bit-*`), pipeline logging berjalan benar.

### 7. Troubleshooting logging

```bash
# DaemonSet tidak siap
kubectl get pods -n microservices -l app=fluent-bit
kubectl describe pod -n microservices -l app=fluent-bit

# Cek konfigurasi yang dipakai
kubectl get configmap fluent-bit-config -n microservices -o yaml

# Terapkan ulang konfigurasi setelah diubah
kubectl apply -f k8s/logging/fluent-bit-configmap.yaml
kubectl rollout restart daemonset/fluent-bit -n microservices
kubectl rollout status daemonset/fluent-bit -n microservices
```

Catatan:
- Fluent Bit membaca log seluruh pod di node, sehingga log `kube-system` juga terlihat. Filter dengan `namespace_name` untuk membatasi ke `microservices`.
- Untuk mengirim log ke backend lain (Elasticsearch, Loki, dsb.), ubah bagian `[OUTPUT]` pada `k8s/logging/fluent-bit-configmap.yaml`.
- `Exclude_Path /var/log/containers/*fluent-bit*.log` mencegah Fluent Bit membaca log output-nya sendiri.

## CI/CD GitHub Actions

Workflow `.github/workflows/ci-cd.yml` berjalan saat push ke branch `main` atau manual dispatch:

1. Build image `user-service` dan `auth-service` dengan Docker Buildx.
2. Push image ke GHCR dengan tag commit SHA dan `latest`.
3. Apply manifest Kubernetes menggunakan `kubectl apply -k k8s/`.
4. Update image tag di `k8s/kustomization.yaml` sesuai commit SHA.
5. Tunggu rollout MySQL, kedua service, dan Nginx selesai.

### Secret yang dibutuhkan

Tambahkan repository secret `KUBE_CONFIG` berisi kubeconfig klaster yang sudah di-base64.

Linux/macOS:

```bash
base64 -w 0 ~/.kube/config
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\.kube\config"))
```

`GITHUB_TOKEN` sudah tersedia otomatis dan dipakai untuk push image serta membuat image pull secret `ghcr-secret`.

### Akses image GHCR

Pipeline membuat secret `ghcr-secret` dan menambahkan `imagePullSecrets` ke deployment saat deploy. Untuk pod yang dijadwalkan ulang setelah token kedaluwarsa, buat secret permanen dengan Personal Access Token (`read:packages`):

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-pat> \
  --namespace=microservices
```

Alternatif lain: ubah visibility package GHCR menjadi public.

## Keamanan

- Nilai di `k8s/*-secret.yaml` adalah contoh untuk development. Ganti dengan nilai produksi sebelum deploy.
- Jangan commit kubeconfig atau kredensial nyata ke repository.
- Untuk produksi, gunakan Sealed Secrets, External Secrets Operator, atau secret manager lain.
- Container aplikasi berjalan sebagai non-root (UID 1000) dan capability di-drop.
- Batasi akses NodePort/LoadBalancer sesuai kebutuhan.

## Troubleshooting

```bash
kubectl describe pod -n microservices <pod-name>
kubectl logs -n microservices deploy/user-service --tail=100
kubectl logs -n microservices deploy/auth-service --tail=100
kubectl logs -n microservices deploy/mysql --tail=100
kubectl logs -n microservices -l app=fluent-bit --tail=100
```

Jika pod aplikasi gagal konek database, pastikan MySQL sudah `Ready` dan secret `mysql-secret`/`app-secret` memiliki nilai yang sama. Jika image gagal di-pull, pastikan tag image sudah di-push ke registry dan `imagePullSecrets` dikonfigurasi.
