# GCP Infrastructure Setup for Teachers Training System
## Scalable Architecture for 20,000+ Concurrent Users

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Scaling Configuration](#scaling-configuration)
5. [Cost Optimization](#cost-optimization)
6. [Monitoring & Alerts](#monitoring--alerts)

## 🏗️ Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Cloud Load Balancer                      │
│                    (Global, SSL, CDN)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Cloud Armor (DDoS)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│               GKE Autopilot Cluster                          │
│  ┌──────────────────────────────────────────────────┐       │
│  │   Node.js App Pods (Auto-scaling 10-100)         │       │
│  └──────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬─────────────────┐
        │                │                │                 │
┌───────▼──────┐ ┌───────▼──────┐ ┌──────▼───────┐ ┌───────▼──────┐
│ Cloud SQL    │ │  Memorystore │ │  Cloud       │ │   Vertex     │
│ PostgreSQL   │ │    Redis     │ │  Storage     │ │     AI       │
│ (HA Config)  │ │   (Cache)    │ │   (Files)    │ │  (Gen AI)    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │                                   │
┌───────▼──────┐                   ┌───────▼──────┐
│   ChromaDB   │                   │    Neo4j     │
│  (GCE/GKE)   │                   │   (GCE/GKE)  │
└──────────────┘                   └──────────────┘
```

## 📦 Prerequisites

### 1. GCP Account Setup
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize gcloud
gcloud init

# Set project
export PROJECT_ID="teachers-training-prod"
gcloud config set project $PROJECT_ID
```

### 2. Enable Required APIs
```bash
gcloud services enable \
  compute.googleapis.com \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  aiplatform.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 📝 Step-by-Step Setup

### Step 1: Create GKE Autopilot Cluster
```bash
# Create Autopilot cluster (managed Kubernetes)
gcloud container clusters create-auto teachers-training-cluster \
  --region us-central1 \
  --network "default" \
  --enable-stackdriver-kubernetes \
  --enable-ip-alias \
  --release-channel regular

# Get credentials
gcloud container clusters get-credentials teachers-training-cluster \
  --region us-central1
```

### Step 2: Setup Cloud SQL PostgreSQL
```bash
# Create Cloud SQL instance with High Availability
gcloud sql instances create teachers-training-db \
  --database-version=POSTGRES_14 \
  --tier=db-custom-4-16384 \
  --region=us-central1 \
  --network=default \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --insights-config-enabled \
  --insights-config-query-insights-enabled \
  --insights-config-record-application-tags

# Create database
gcloud sql databases create teachers_training \
  --instance=teachers-training-db

# Create user
gcloud sql users create app_user \
  --instance=teachers-training-db \
  --password=<SECURE_PASSWORD>

# Enable connection pooling
gcloud sql instances patch teachers-training-db \
  --database-flags=max_connections=500,shared_buffers=256MB
```

### Step 3: Setup Memorystore Redis
```bash
# Create Redis instance for caching
gcloud redis instances create teachers-training-cache \
  --size=5 \
  --region=us-central1 \
  --zone=us-central1-a \
  --redis-version=redis_6_x \
  --tier=STANDARD_HA \
  --replica-count=1 \
  --read-replicas-mode=READ_REPLICAS_ENABLED \
  --persistence-mode=RDB \
  --rdb-snapshot-period=12h
```

### Step 4: Setup Cloud Storage
```bash
# Create storage buckets
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://teachers-training-uploads
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://teachers-training-backups

# Set lifecycle rules for cost optimization
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 30}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://teachers-training-uploads
```

### Step 5: Deploy ChromaDB on GKE
```yaml
# chromadb-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: chromadb
spec:
  serviceName: chromadb
  replicas: 3
  selector:
    matchLabels:
      app: chromadb
  template:
    metadata:
      labels:
        app: chromadb
    spec:
      containers:
      - name: chromadb
        image: chromadb/chroma:latest
        ports:
        - containerPort: 8000
        env:
        - name: IS_PERSISTENT
          value: "TRUE"
        - name: PERSIST_DIRECTORY
          value: "/data/chroma"
        volumeMounts:
        - name: chroma-storage
          mountPath: /data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
  volumeClaimTemplates:
  - metadata:
      name: chroma-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: chromadb
spec:
  selector:
    app: chromadb
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Step 6: Deploy Neo4j on GKE
```yaml
# neo4j-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: neo4j
spec:
  serviceName: neo4j
  replicas: 3
  selector:
    matchLabels:
      app: neo4j
  template:
    metadata:
      labels:
        app: neo4j
    spec:
      containers:
      - name: neo4j
        image: neo4j:5.0-enterprise
        ports:
        - containerPort: 7474
        - containerPort: 7687
        env:
        - name: NEO4J_AUTH
          valueFrom:
            secretKeyRef:
              name: neo4j-secret
              key: auth
        - name: NEO4J_EDITION
          value: "ENTERPRISE"
        - name: NEO4J_ACCEPT_LICENSE_AGREEMENT
          value: "yes"
        - name: NEO4J_dbms_mode
          value: "CORE"
        volumeMounts:
        - name: neo4j-storage
          mountPath: /data
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
  volumeClaimTemplates:
  - metadata:
      name: neo4j-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 200Gi
```

### Step 7: Deploy Application to GKE
```yaml
# app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: teachers-training-app
spec:
  replicas: 10
  selector:
    matchLabels:
      app: teachers-training
  template:
    metadata:
      labels:
        app: teachers-training
    spec:
      containers:
      - name: app
        image: gcr.io/teachers-training-prod/app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        - name: NEO4J_URI
          value: "bolt://neo4j:7687"
        - name: CHROMADB_URL
          value: "http://chromadb:8000"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: teachers-training-service
spec:
  selector:
    app: teachers-training
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Step 8: Configure Horizontal Pod Autoscaling
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: teachers-training-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: teachers-training-app
  minReplicas: 10
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 10
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Step 9: Setup Cloud Load Balancer with CDN
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: teachers-training-ingress
  annotations:
    kubernetes.io/ingress.global-static-ip-name: "teachers-training-ip"
    networking.gke.io/managed-certificates: "teachers-training-cert"
    kubernetes.io/ingress.class: "gce"
    cloud.google.com/backend-config: '{"default": "backend-config"}'
    cloud.google.com/armor-config: '{"rule": "teachers-training-armor"}'
spec:
  rules:
  - host: api.teachers-training.com
    http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: teachers-training-service
            port:
              number: 80
---
apiVersion: cloud.google.com/v1
kind: BackendConfig
metadata:
  name: backend-config
spec:
  cdn:
    enabled: true
    cachePolicy:
      includeHost: true
      includeProtocol: true
      includeQueryString: false
    negativeCaching: true
    negativeCachingPolicy:
    - code: 404
      ttl: 120
  connectionDraining:
    drainingTimeoutSec: 60
  healthCheck:
    checkIntervalSec: 10
    port: 3000
    type: HTTP
    requestPath: /health
```

### Step 10: Setup Cloud Armor for DDoS Protection
```bash
# Create security policy
gcloud compute security-policies create teachers-training-armor \
  --description "DDoS and security protection"

# Add rate limiting rule
gcloud compute security-policies rules create 1000 \
  --security-policy teachers-training-armor \
  --expression "origin.region_code == 'CN'" \
  --action "deny-403"

# Add rate limiting
gcloud compute security-policies rules create 2000 \
  --security-policy teachers-training-armor \
  --expression "true" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600
```

## 🔧 Scaling Configuration

### Database Connection Pooling
```javascript
// config/database.config.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'teachers_training',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 100, // Maximum connections in pool
  min: 10,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Redis Configuration
```javascript
// config/redis.config.js
const Redis = require('ioredis');

const redis = new Redis.Cluster([
  {
    host: process.env.REDIS_HOST,
    port: 6379,
  }
], {
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});
```

### Session Affinity Configuration
```yaml
apiVersion: v1
kind: Service
metadata:
  name: teachers-training-service
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 600
```

## 💰 Cost Optimization

### 1. Use Committed Use Discounts
```bash
# Purchase 1-year commitment for steady workload
gcloud compute commitments create teachers-training-commitment \
  --region=us-central1 \
  --resources=vcpu=100,memory=400gb \
  --plan=twelve-months
```

### 2. Implement Autoscaling Policies
```yaml
# Reduce replicas during off-peak hours
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-night
spec:
  schedule: "0 22 * * *"  # 10 PM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - kubectl
            - scale
            - deployment/teachers-training-app
            - --replicas=5
```

### 3. Use Preemptible Instances for Batch Jobs
```yaml
nodeSelector:
  cloud.google.com/gke-preemptible: "true"
tolerations:
- key: cloud.google.com/gke-preemptible
  operator: Equal
  value: "true"
  effect: NoSchedule
```

## 📊 Monitoring & Alerts

### Setup Cloud Monitoring
```yaml
# monitoring.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: teachers-training-monitor
spec:
  selector:
    matchLabels:
      app: teachers-training
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Create Alerting Policies
```bash
# CPU Alert
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="High CPU Usage" \
  --condition="resource.type=\"k8s_container\" AND
               metric.type=\"kubernetes.io/container/cpu/request_utilization\" AND
               resource.label.cluster_name=\"teachers-training-cluster\" AND
               metric.value > 0.8"

# Memory Alert
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="High Memory Usage" \
  --condition="resource.type=\"k8s_container\" AND
               metric.type=\"kubernetes.io/container/memory/request_utilization\" AND
               resource.label.cluster_name=\"teachers-training-cluster\" AND
               metric.value > 0.8"

# Error Rate Alert
gcloud alpha monitoring policies create \
  --notification-channels=<CHANNEL_ID> \
  --display-name="High Error Rate" \
  --condition="resource.type=\"k8s_container\" AND
               metric.type=\"logging.googleapis.com/user/error_rate\" AND
               metric.value > 0.01"
```

### Setup Dashboards
```json
{
  "displayName": "Teachers Training Dashboard",
  "dashboardFilters": [],
  "gridLayout": {
    "widgets": [
      {
        "title": "Request Rate",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"k8s_container\" metric.type=\"istio.io/service/server/request_count\"",
                "aggregation": {
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Response Latency",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"k8s_container\" metric.type=\"istio.io/service/server/response_latencies\"",
                "aggregation": {
                  "perSeriesAligner": "ALIGN_DELTA",
                  "crossSeriesReducer": "REDUCE_PERCENTILE_95"
                }
              }
            }
          }]
        }
      }
    ]
  }
}
```

## 🔍 Load Testing

### Prepare Load Test
```bash
# Install hey
go install github.com/rakyll/hey@latest

# Run load test
hey -n 100000 -c 1000 -m POST \
  -H "Content-Type: application/json" \
  -d '{"query": "test question"}' \
  https://api.teachers-training.com/api/rag/query
```

## 📈 Performance Targets

| Metric | Target | Method |
|--------|---------|--------|
| Concurrent Users | 20,000+ | GKE Autoscaling |
| Response Time (p50) | < 200ms | Redis Caching |
| Response Time (p95) | < 500ms | CDN + Edge Caching |
| Response Time (p99) | < 1s | Query Optimization |
| Availability | 99.9% | Multi-zone HA |
| Error Rate | < 0.1% | Circuit Breakers |
| Throughput | 1000 req/s | Load Balancing |

## 🚀 Deployment Script

```bash
#!/bin/bash
# deploy.sh

set -e

# Build and push Docker image
docker build -t gcr.io/$PROJECT_ID/teachers-training-app:latest .
docker push gcr.io/$PROJECT_ID/teachers-training-app:latest

# Apply Kubernetes configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/chromadb-deployment.yaml
kubectl apply -f k8s/neo4j-deployment.yaml
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# Wait for deployment
kubectl rollout status deployment/teachers-training-app -n production

echo "Deployment complete!"
```

## 🔒 Security Best Practices

1. **Enable Binary Authorization**
```bash
gcloud container binauthz policy import policy.yaml
```

2. **Use Workload Identity**
```bash
kubectl create serviceaccount teachers-training-ksa
gcloud iam service-accounts create teachers-training-gsa
gcloud iam service-accounts add-iam-policy-binding \
  teachers-training-gsa@$PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:$PROJECT_ID.svc.id.goog[default/teachers-training-ksa]"
```

3. **Enable Secret Manager**
```bash
echo -n "$(gcloud secrets versions access latest --secret=db-password)" | \
  kubectl create secret generic db-secret --from-file=password=/dev/stdin
```

## 📝 Estimated Monthly Costs

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| GKE Autopilot | 10-100 pods | $500-2000 |
| Cloud SQL | 4 vCPU, 16GB RAM, HA | $400 |
| Memorystore Redis | 5GB, HA | $250 |
| Cloud Storage | 1TB | $20 |
| Load Balancer | With CDN | $100 |
| Network Egress | 5TB | $600 |
| Vertex AI | 1M requests | $1000 |
| **Total Estimated** | | **$2,870-4,370** |

*Note: Costs can be reduced by 30-50% with committed use discounts*

## ✅ Checklist

- [ ] GCP Project created
- [ ] APIs enabled
- [ ] GKE cluster deployed
- [ ] Cloud SQL configured
- [ ] Redis cache setup
- [ ] ChromaDB deployed
- [ ] Neo4j deployed
- [ ] Application deployed
- [ ] Autoscaling configured
- [ ] Load balancer setup
- [ ] CDN enabled
- [ ] Cloud Armor configured
- [ ] Monitoring enabled
- [ ] Alerts configured
- [ ] Load testing completed
- [ ] Security hardened
- [ ] Backup strategy implemented
- [ ] Disaster recovery tested

## 🆘 Support

For issues or questions:
- GCP Support: https://cloud.google.com/support
- Documentation: https://cloud.google.com/docs
- Community: https://cloud.google.com/community