# GCP Quick Setup Guide for Teachers Training System

## 🚀 Quick Start (15 minutes)

### Prerequisites
- GCP Account with billing enabled
- Local tools: `gcloud`, `kubectl`, `docker`
- Domain name for SSL (optional)

### Step 1: Clone and Configure
```bash
# Clone repository
git clone <your-repo-url>
cd teachers-training

# Set environment variables
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="us-central1"
```

### Step 2: Run Automated Deployment
```bash
# Make script executable
chmod +x scripts/deploy-to-gcp.sh

# Run deployment
./scripts/deploy-to-gcp.sh
```

The script will:
- ✅ Enable required APIs
- ✅ Create GKE cluster
- ✅ Setup Cloud SQL PostgreSQL
- ✅ Setup Redis cache
- ✅ Deploy application
- ✅ Configure autoscaling
- ✅ Setup Cloud Armor DDoS protection

### Step 3: Verify Deployment
```bash
# Check pods
kubectl get pods -n production

# Check services
kubectl get svc -n production

# Test health endpoint
curl http://<EXTERNAL_IP>/health
```

## 📊 Architecture Components

| Component | Purpose | Configuration |
|-----------|---------|---------------|
| **GKE Autopilot** | Managed Kubernetes | 10-100 pods autoscaling |
| **Cloud SQL** | PostgreSQL database | 4 vCPU, 16GB RAM, HA |
| **Memorystore** | Redis cache | 5GB, High Availability |
| **Cloud Load Balancer** | Traffic distribution | Global, with CDN |
| **Cloud Armor** | DDoS protection | Rate limiting enabled |
| **Vertex AI** | AI/ML services | For RAG responses |

## 🔧 Manual Setup Steps

### 1. Create GCP Project
```bash
gcloud projects create teachers-training-prod
gcloud config set project teachers-training-prod
gcloud billing projects link teachers-training-prod --billing-account=<BILLING_ACCOUNT_ID>
```

### 2. Enable APIs
```bash
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  aiplatform.googleapis.com
```

### 3. Create GKE Cluster
```bash
gcloud container clusters create-auto teachers-training-cluster \
  --region=us-central1 \
  --enable-stackdriver-kubernetes
```

### 4. Setup Cloud SQL
```bash
# Create instance
gcloud sql instances create teachers-training-db \
  --database-version=POSTGRES_14 \
  --tier=db-custom-4-16384 \
  --region=us-central1 \
  --availability-type=REGIONAL

# Create database
gcloud sql databases create teachers_training \
  --instance=teachers-training-db

# Create user
gcloud sql users create app_user \
  --instance=teachers-training-db \
  --password=<SECURE_PASSWORD>
```

### 5. Setup Redis
```bash
gcloud redis instances create teachers-training-cache \
  --size=5 \
  --region=us-central1 \
  --tier=STANDARD_HA
```

### 6. Deploy Application
```bash
# Build and push image
docker build -t gcr.io/teachers-training-prod/app:latest .
docker push gcr.io/teachers-training-prod/app:latest

# Apply Kubernetes configs
kubectl apply -f k8s/deployment.yaml
```

## 🔐 Security Configuration

### 1. Create Service Account
```bash
gcloud iam service-accounts create teachers-training-sa \
  --display-name="Teachers Training Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding teachers-training-prod \
  --member="serviceAccount:teachers-training-sa@teachers-training-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding teachers-training-prod \
  --member="serviceAccount:teachers-training-sa@teachers-training-prod.iam.gserviceaccount.com" \
  --role="roles/redis.editor"
```

### 2. Setup Workload Identity
```bash
kubectl create serviceaccount teachers-training-ksa -n production

gcloud iam service-accounts add-iam-policy-binding \
  teachers-training-sa@teachers-training-prod.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:teachers-training-prod.svc.id.goog[production/teachers-training-ksa]"

kubectl annotate serviceaccount teachers-training-ksa \
  -n production \
  iam.gke.io/gcp-service-account=teachers-training-sa@teachers-training-prod.iam.gserviceaccount.com
```

### 3. Configure SSL
```bash
# Create managed certificate
kubectl apply -f - <<EOF
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: teachers-training-cert
  namespace: production
spec:
  domains:
  - api.teachers-training.com
EOF
```

## 📈 Scaling Guidelines

### Traffic Patterns
- **Peak Hours**: 8 AM - 6 PM local time
- **Expected Load**: 20,000+ concurrent users
- **Request Rate**: 1000+ req/s peak

### Autoscaling Configuration
```yaml
minReplicas: 10     # Minimum pods
maxReplicas: 100    # Maximum pods
targetCPU: 70%      # Scale up at 70% CPU
targetMemory: 80%   # Scale up at 80% memory
```

### Database Connections
- **Max Connections**: 500
- **Pool Size**: 100 per pod
- **Idle Timeout**: 30 seconds

## 🔍 Monitoring

### Key Metrics to Watch
1. **Response Time**: Target < 500ms p95
2. **Error Rate**: Target < 0.1%
3. **CPU Usage**: Keep below 70%
4. **Memory Usage**: Keep below 80%
5. **Database Connections**: Monitor pool usage

### Useful Commands
```bash
# View logs
kubectl logs -f -n production -l app=teachers-training

# Check pod metrics
kubectl top pods -n production

# View HPA status
kubectl get hpa -n production

# Database connections
gcloud sql operations list --instance=teachers-training-db

# Redis memory usage
gcloud redis instances describe teachers-training-cache --region=us-central1
```

## 🚨 Troubleshooting

### Pod CrashLoopBackOff
```bash
# Check logs
kubectl logs <pod-name> -n production --previous

# Describe pod
kubectl describe pod <pod-name> -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Database Connection Issues
```bash
# Check Cloud SQL proxy
kubectl logs -n production -l component=cloudsql-proxy

# Test connection
gcloud sql connect teachers-training-db --user=app_user
```

### High Memory Usage
```bash
# Scale up pods
kubectl scale deployment teachers-training-app -n production --replicas=20

# Increase memory limits
kubectl set resources deployment teachers-training-app -n production \
  --limits=memory=2Gi --requests=memory=1Gi
```

## 💰 Cost Optimization Tips

1. **Use Committed Use Discounts**: Save 30-57% with 1-3 year commitments
2. **Enable Cluster Autoscaler**: Scale nodes based on actual usage
3. **Use Preemptible VMs**: For non-critical workloads (80% cheaper)
4. **Setup Budget Alerts**: Monitor spending
5. **Optimize Images**: Use multi-stage Docker builds
6. **Enable CDN**: Reduce egress costs

## 📞 Support Resources

- **GCP Console**: https://console.cloud.google.com
- **GKE Documentation**: https://cloud.google.com/kubernetes-engine/docs
- **Status Page**: https://status.cloud.google.com
- **Support**: https://cloud.google.com/support

## ✅ Production Checklist

- [ ] DNS configured
- [ ] SSL certificate active
- [ ] Monitoring alerts setup
- [ ] Backup strategy implemented
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] Team access configured
- [ ] Budget alerts enabled
- [ ] Disaster recovery tested