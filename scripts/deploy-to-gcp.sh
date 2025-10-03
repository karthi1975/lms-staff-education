#!/bin/bash

# Deploy Teachers Training System to GCP
# Handles 20,000+ concurrent users

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"teachers-training-prod"}
REGION=${GCP_REGION:-"us-central1"}
CLUSTER_NAME="teachers-training-cluster"
IMAGE_NAME="teachers-training-app"
IMAGE_TAG=${IMAGE_TAG:-"latest"}

echo -e "${GREEN}🚀 Starting deployment to GCP...${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists gcloud; then
    echo -e "${RED}❌ gcloud CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command_exists kubectl; then
    echo -e "${RED}❌ kubectl not found. Please install it first.${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
    exit 1
fi

# Set GCP project
echo -e "${YELLOW}🔧 Setting GCP project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}🔌 Enabling required APIs...${NC}"
gcloud services enable \
    container.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    aiplatform.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo -e "${YELLOW}📦 Setting up Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe $IMAGE_NAME --location=$REGION >/dev/null 2>&1; then
    gcloud artifacts repositories create $IMAGE_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker repository for Teachers Training app"
fi

# Configure Docker authentication
echo -e "${YELLOW}🔐 Configuring Docker authentication...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push Docker image
echo -e "${YELLOW}🏗️ Building Docker image...${NC}"
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${IMAGE_NAME}/${IMAGE_NAME}:${IMAGE_TAG} .

echo -e "${YELLOW}📤 Pushing Docker image...${NC}"
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${IMAGE_NAME}/${IMAGE_NAME}:${IMAGE_TAG}

# Create GKE cluster if it doesn't exist
echo -e "${YELLOW}☸️ Setting up GKE cluster...${NC}"
if ! gcloud container clusters describe $CLUSTER_NAME --region=$REGION >/dev/null 2>&1; then
    echo -e "${GREEN}Creating GKE Autopilot cluster...${NC}"
    gcloud container clusters create-auto $CLUSTER_NAME \
        --region=$REGION \
        --enable-stackdriver-kubernetes \
        --enable-ip-alias \
        --network="default" \
        --release-channel=regular
else
    echo -e "${GREEN}Cluster already exists${NC}"
fi

# Get cluster credentials
echo -e "${YELLOW}🔑 Getting cluster credentials...${NC}"
gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION

# Create namespace if it doesn't exist
echo -e "${YELLOW}📁 Creating namespace...${NC}"
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

# Create secrets
echo -e "${YELLOW}🔒 Creating secrets...${NC}"
read -p "Enter database password: " -s DB_PASSWORD
echo
read -p "Enter Redis password: " -s REDIS_PASSWORD
echo
read -p "Enter JWT secret: " -s JWT_SECRET
echo
read -p "Enter WhatsApp token: " -s WHATSAPP_TOKEN
echo
read -p "Enter Vertex AI key: " -s VERTEX_KEY
echo
read -p "Enter Neo4j password: " -s NEO4J_PASSWORD
echo

kubectl create secret generic app-secrets \
    --namespace=production \
    --from-literal=database-url="postgresql://app_user:${DB_PASSWORD}@10.0.0.3:5432/teachers_training?sslmode=require" \
    --from-literal=redis-url="redis://:${REDIS_PASSWORD}@10.0.0.4:6379" \
    --from-literal=jwt-secret="${JWT_SECRET}" \
    --from-literal=whatsapp-token="${WHATSAPP_TOKEN}" \
    --from-literal=vertex-api-key="${VERTEX_KEY}" \
    --from-literal=neo4j-auth="neo4j/${NEO4J_PASSWORD}" \
    --dry-run=client -o yaml | kubectl apply -f -

# Update deployment image
echo -e "${YELLOW}🔄 Updating deployment image...${NC}"
sed -i.bak "s|gcr.io/teachers-training-prod/app:latest|${REGION}-docker.pkg.dev/${PROJECT_ID}/${IMAGE_NAME}/${IMAGE_NAME}:${IMAGE_TAG}|g" k8s/deployment.yaml

# Apply Kubernetes configurations
echo -e "${YELLOW}📝 Applying Kubernetes configurations...${NC}"
kubectl apply -f k8s/deployment.yaml

# Wait for deployment to be ready
echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/teachers-training-app -n production --timeout=600s

# Get service external IP
echo -e "${YELLOW}🌐 Getting service endpoint...${NC}"
EXTERNAL_IP=""
while [ -z $EXTERNAL_IP ]; do
    echo "Waiting for external IP..."
    EXTERNAL_IP=$(kubectl get svc teachers-training-service -n production --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
    [ -z "$EXTERNAL_IP" ] && sleep 10
done

# Setup Cloud SQL if needed
echo -e "${YELLOW}💾 Setting up Cloud SQL...${NC}"
if ! gcloud sql instances describe teachers-training-db >/dev/null 2>&1; then
    echo -e "${GREEN}Creating Cloud SQL instance...${NC}"
    gcloud sql instances create teachers-training-db \
        --database-version=POSTGRES_14 \
        --tier=db-custom-4-16384 \
        --region=$REGION \
        --availability-type=REGIONAL \
        --backup-start-time=03:00 \
        --database-flags=max_connections=500,shared_buffers=256MB
    
    # Create database
    gcloud sql databases create teachers_training --instance=teachers-training-db
    
    # Create user
    gcloud sql users create app_user --instance=teachers-training-db --password=$DB_PASSWORD
else
    echo -e "${GREEN}Cloud SQL instance already exists${NC}"
fi

# Setup Redis if needed
echo -e "${YELLOW}💨 Setting up Redis...${NC}"
if ! gcloud redis instances describe teachers-training-cache --region=$REGION >/dev/null 2>&1; then
    echo -e "${GREEN}Creating Redis instance...${NC}"
    gcloud redis instances create teachers-training-cache \
        --size=5 \
        --region=$REGION \
        --redis-version=redis_6_x \
        --tier=STANDARD_HA
else
    echo -e "${GREEN}Redis instance already exists${NC}"
fi

# Create static IP if needed
echo -e "${YELLOW}🌍 Setting up static IP...${NC}"
if ! gcloud compute addresses describe teachers-training-ip --global >/dev/null 2>&1; then
    gcloud compute addresses create teachers-training-ip --global
fi

STATIC_IP=$(gcloud compute addresses describe teachers-training-ip --global --format="get(address)")

# Setup Cloud Armor
echo -e "${YELLOW}🛡️ Setting up Cloud Armor...${NC}"
if ! gcloud compute security-policies describe teachers-training-armor >/dev/null 2>&1; then
    # Create security policy
    gcloud compute security-policies create teachers-training-armor \
        --description "DDoS and security protection"
    
    # Add rate limiting
    gcloud compute security-policies rules create 1000 \
        --security-policy teachers-training-armor \
        --expression "true" \
        --action "rate-based-ban" \
        --rate-limit-threshold-count 100 \
        --rate-limit-threshold-interval-sec 60 \
        --ban-duration-sec 600
fi

# Setup monitoring
echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
gcloud alpha monitoring policies create \
    --display-name="High CPU Usage - Teachers Training" \
    --condition="resource.type=\"k8s_container\" AND metric.type=\"kubernetes.io/container/cpu/request_utilization\" AND resource.label.cluster_name=\"${CLUSTER_NAME}\" AND metric.value > 0.8" \
    --notification-channels="" \
    --documentation="CPU usage is above 80% for Teachers Training app" \
    --dry-run 2>/dev/null || true

# Output summary
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}📍 External IP: ${EXTERNAL_IP}${NC}"
echo -e "${GREEN}📍 Static IP: ${STATIC_IP}${NC}"
echo -e "${GREEN}📍 Cluster: ${CLUSTER_NAME}${NC}"
echo -e "${GREEN}📍 Region: ${REGION}${NC}"
echo -e "${GREEN}📍 Project: ${PROJECT_ID}${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update DNS records to point to: ${STATIC_IP}"
echo -e "2. Configure SSL certificate"
echo -e "3. Test the application: curl http://${EXTERNAL_IP}/health"
echo -e "4. Monitor logs: kubectl logs -f -n production -l app=teachers-training"
echo -e "${GREEN}========================================${NC}"

# Test health endpoint
echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
if curl -f http://${EXTERNAL_IP}/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}❌ Health check failed. Check logs for details.${NC}"
fi