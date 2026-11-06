saya menggunakan docker dekstop di lokal laptop saya. Bertindaklah sebagai Senior DevOps Engineer dan Kubernetes Specialist. Saya ingin Anda merancang dan membuatkan seluruh file konfigurasi infrastruktur untuk sebuah aplikasi berarsitektur **Microservices** dengan spesifikasi dan detail komponen sebagai berikut:

### 1. Arsitektur & Komponen Infrastruktur
* **Service 1 (User Service):** Backend service untuk manajemen data pengguna, yang terhubung langsung ke database MySQL.
* **Service 2 (Authentication Service):** Backend service khusus untuk menangani proses autentikasi (login, register, token validation).
* **Database:** MySQL (digunakan oleh User Service, dilengkapi konfigurasi PersistentVolume / PVC dan Secret).
* **Load Balancer & Reverse Proxy:** Nginx, yang berfungsi sebagai *gateway* / *reverse proxy* untuk merutekan traffic HTTP masuk secara cerdas (misal: route `/api/users` ke User Service dan `/api/auth` ke Auth Service), sekaligus melakukan *load balancing*.
* **Centralized Logging:** Konfigurasi logging terpusat di Kubernetes (menggunakan DaemonSet seperti Fluent Bit atau arsitektur logging ringan yang siap mengumpulkan log dari semua pods).
* **CI/CD Pipeline:** GitHub Actions untuk otomatisasi *build Docker image*, *push* ke container registry, dan *deployment/update* manifest ke klaster Kubernetes secara otomatis.

### 2. Teknologi yang Digunakan
* **Containerization:** Docker & Dockerfile
* **Orchestration:** Kubernetes (K8s) YAML Manifests (`Deployment`, `Service`, `ConfigMap`, `Secret`, `PersistentVolumeClaim`, `Ingress` / `Nginx ConfigMap`)
* **Automation:** GitHub Actions (`.github/workflows/ci-cd.yml`)

### 3. Deliverables (Apa yang harus Anda buatkan)
Tolong berikan seluruh kode, skrip, dan file konfigurasi secara lengkap dan siap pakai (tanpa ada bagian yang disingkat atau placeholder kosong), yang mencakup:

1. **Struktur Direktori Proyek** (Representasi struktur folder yang rapi untuk manajemen folder `k8s/` dan konfigurasi).
2. **Dockerfile** untuk masing-masing service (multi-stage build yang optimal).
3. **Konfigurasi Nginx (`nginx.conf`)** untuk *reverse proxy* yang memisahkan routing traffic ke `user-service` dan `auth-service`.
4. **Manifest Kubernetes (`k8s/`)**:
   * `namespace.yaml`
   * `mysql-deployment.yaml`, `mysql-pvc.yaml`, `mysql-secret.yaml`, & `mysql-service.yaml`
   * `user-service-deployment.yaml` & `user-service-service.yaml`
   * `auth-service-deployment.yaml` & `auth-service-service.yaml`
   * `nginx-proxy-deployment.yaml`, `nginx-proxy-service.yaml`, & `nginx-configmap.yaml`
   * Konfigurasi Centralized Logging (manifest DaemonSet/Fluent Bit sederhana).
5. **GitHub Actions Workflow (`.github/workflows/ci-cd.yml`)** untuk tahap *Build*, *Push* (ke Docker Hub atau GitHub Container Registry), dan *Apply Kubernetes Manifests* secara otomatis.

Berikan penjelasan singkat dan instruksi cara *apply* file-file tersebut ke klaster Kubernetes.