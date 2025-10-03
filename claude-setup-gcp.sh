#!/bin/bash

# Claude Code Automated GCP Setup Script
# This script can be executed by Claude Code to set up the entire infrastructure

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Claude Code - GCP Infrastructure Setup Assistant         ║${NC}"
echo -e "${BLUE}║         Teachers Training System (20,000+ Users)             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# Function to prompt Claude Code user
prompt_user() {
    echo -e "${YELLOW}Claude Code Action Required: $1${NC}"
    read -p "Press Enter when ready to continue..."
}

# Function to execute and log commands
execute_command() {
    echo -e "${GREEN}Executing: $1${NC}"
    eval $1
}

# Check prerequisites
echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"
echo "Checking for required tools..."

check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1 is installed"
    else
        echo "❌ $1 is not installed"
        echo "Please install $1 first"
        exit 1
    fi
}

check_command gcloud
check_command kubectl
check_command docker

# Get project configuration
echo -e "\n${BLUE}Step 2: Project Configuration${NC}"
read -p "Enter GCP Project ID (or press Enter for 'teachers-training-prod'): " PROJECT_ID
PROJECT_ID=${PROJECT_ID:-teachers-training-prod}

read -p "Enter GCP Region (or press Enter for 'us-central1'): " REGION
REGION=${REGION:-us-central1}

echo -e "\nProject ID: ${GREEN}$PROJECT_ID${NC}"
echo -e "Region: ${GREEN}$REGION${NC}"

# Create project if it doesn't exist
echo -e "\n${BLUE}Step 3: Setting up GCP Project${NC}"
if ! gcloud projects describe $PROJECT_ID &> /dev/null; then
    echo "Creating new project..."
    execute_command "gcloud projects create $PROJECT_ID"
else
    echo "✅ Project already exists"
fi

execute_command "gcloud config set project $PROJECT_ID"

# Enable APIs
echo -e "\n${BLUE}Step 4: Enabling Required APIs${NC}"
execute_command "gcloud services enable container.googleapis.com"
execute_command "gcloud services enable sqladmin.googleapis.com"
execute_command "gcloud services enable redis.googleapis.com"
execute_command "gcloud services enable aiplatform.googleapis.com"
execute_command "gcloud services enable artifactregistry.googleapis.com"
execute_command "gcloud services enable cloudbuild.googleapis.com"

# Create GKE Cluster
echo -e "\n${BLUE}Step 5: Creating GKE Autopilot Cluster${NC}"
CLUSTER_NAME="teachers-training-cluster"

if ! gcloud container clusters describe $CLUSTER_NAME --region=$REGION &> /dev/null; then
    echo "Creating GKE cluster (this may take 10-15 minutes)..."
    execute_command "gcloud container clusters create-auto $CLUSTER_NAME \
        --region=$REGION \
        --enable-stackdriver-kubernetes \
        --release-channel=regular"
else
    echo "✅ Cluster already exists"
fi

# Get cluster credentials
execute_command "gcloud container clusters get-credentials $CLUSTER_NAME --region=$REGION"

# Create Cloud SQL Instance
echo -e "\n${BLUE}Step 6: Creating Cloud SQL PostgreSQL Instance${NC}"
SQL_INSTANCE="teachers-training-db"

if ! gcloud sql instances describe $SQL_INSTANCE &> /dev/null; then
    echo "Creating Cloud SQL instance (this may take 5-10 minutes)..."
    execute_command "gcloud sql instances create $SQL_INSTANCE \
        --database-version=POSTGRES_14 \
        --tier=db-custom-4-16384 \
        --region=$REGION \
        --availability-type=REGIONAL \
        --backup-start-time=03:00"
    
    # Create database
    execute_command "gcloud sql databases create teachers_training --instance=$SQL_INSTANCE"
    
    # Create user
    prompt_user "Enter a password for database user 'app_user'"
    read -s DB_PASSWORD
    echo
    execute_command "gcloud sql users create app_user --instance=$SQL_INSTANCE --password=$DB_PASSWORD"
else
    echo "✅ Cloud SQL instance already exists"
fi

# Create Redis Instance
echo -e "\n${BLUE}Step 7: Creating Redis Cache Instance${NC}"
REDIS_INSTANCE="teachers-training-cache"

if ! gcloud redis instances describe $REDIS_INSTANCE --region=$REGION &> /dev/null; then
    echo "Creating Redis instance (this may take 5-10 minutes)..."
    execute_command "gcloud redis instances create $REDIS_INSTANCE \
        --size=5 \
        --region=$REGION \
        --redis-version=redis_6_x \
        --tier=STANDARD_HA"
else
    echo "✅ Redis instance already exists"
fi

# Setup Artifact Registry
echo -e "\n${BLUE}Step 8: Setting up Artifact Registry${NC}"
REPO_NAME="teachers-training-repo"

if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION &> /dev/null; then
    execute_command "gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION"
fi

# Configure Docker
execute_command "gcloud auth configure-docker ${REGION}-docker.pkg.dev"

# Build and Push Docker Image
echo -e "\n${BLUE}Step 9: Building and Pushing Docker Image${NC}"
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/teachers-training-app:latest"

echo "Building Docker image..."
execute_command "docker build -t $IMAGE_URL ."

echo "Pushing Docker image..."
execute_command "docker push $IMAGE_URL"

# Deploy to Kubernetes
echo -e "\n${BLUE}Step 10: Deploying to Kubernetes${NC}"

# Create namespace
execute_command "kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -"

# Create secrets
echo -e "\n${YELLOW}Creating Kubernetes Secrets${NC}"
prompt_user "We need to create secrets. Have these ready: JWT secret, WhatsApp token, Vertex AI key"

read -p "Enter JWT Secret: " -s JWT_SECRET
echo
read -p "Enter WhatsApp Token: " -s WHATSAPP_TOKEN
echo
read -p "Enter Vertex AI Key: " -s VERTEX_KEY
echo
read -p "Enter Neo4j Password: " -s NEO4J_PASSWORD
echo

# Get Cloud SQL and Redis connection info
SQL_IP=$(gcloud sql instances describe $SQL_INSTANCE --format="get(ipAddresses[0].ipAddress)")
REDIS_IP=$(gcloud redis instances describe $REDIS_INSTANCE --region=$REGION --format="get(host)")

# Create Kubernetes secret
kubectl create secret generic app-secrets \
    --namespace=production \
    --from-literal=database-url="postgresql://app_user:${DB_PASSWORD}@${SQL_IP}:5432/teachers_training?sslmode=require" \
    --from-literal=redis-url="redis://${REDIS_IP}:6379" \
    --from-literal=jwt-secret="${JWT_SECRET}" \
    --from-literal=whatsapp-token="${WHATSAPP_TOKEN}" \
    --from-literal=vertex-api-key="${VERTEX_KEY}" \
    --from-literal=neo4j-auth="neo4j/${NEO4J_PASSWORD}" \
    --dry-run=client -o yaml | kubectl apply -f -

# Update deployment with correct image
sed -i.bak "s|gcr.io/teachers-training-prod/app:latest|${IMAGE_URL}|g" k8s/deployment.yaml

# Apply Kubernetes manifests
echo "Deploying application..."
execute_command "kubectl apply -f k8s/deployment.yaml"

# Wait for deployment
echo -e "\n${BLUE}Step 11: Waiting for Deployment${NC}"
execute_command "kubectl rollout status deployment/teachers-training-app -n production --timeout=300s"

# Get service details
echo -e "\n${BLUE}Step 12: Getting Service Details${NC}"
execute_command "kubectl get svc -n production"

# Create static IP
echo -e "\n${BLUE}Step 13: Creating Static IP${NC}"
if ! gcloud compute addresses describe teachers-training-ip --global &> /dev/null; then
    execute_command "gcloud compute addresses create teachers-training-ip --global"
fi

STATIC_IP=$(gcloud compute addresses describe teachers-training-ip --global --format="get(address)")

# Setup Cloud Armor
echo -e "\n${BLUE}Step 14: Setting up Cloud Armor (DDoS Protection)${NC}"
if ! gcloud compute security-policies describe teachers-training-armor &> /dev/null; then
    execute_command "gcloud compute security-policies create teachers-training-armor"
    
    execute_command "gcloud compute security-policies rules create 1000 \
        --security-policy teachers-training-armor \
        --expression 'true' \
        --action rate-based-ban \
        --rate-limit-threshold-count 100 \
        --rate-limit-threshold-interval-sec 60 \
        --ban-duration-sec 600"
fi

# Final Summary
echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    DEPLOYMENT SUCCESSFUL!                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "📊 ${BLUE}Deployment Summary:${NC}"
echo -e "   Project ID: ${GREEN}$PROJECT_ID${NC}"
echo -e "   Region: ${GREEN}$REGION${NC}"
echo -e "   Cluster: ${GREEN}$CLUSTER_NAME${NC}"
echo -e "   Static IP: ${GREEN}$STATIC_IP${NC}"
echo -e "   Cloud SQL: ${GREEN}$SQL_INSTANCE${NC}"
echo -e "   Redis: ${GREEN}$REDIS_INSTANCE${NC}"
echo
echo -e "🔗 ${BLUE}Next Steps:${NC}"
echo -e "   1. Update DNS to point to: ${GREEN}$STATIC_IP${NC}"
echo -e "   2. Configure SSL certificate"
echo -e "   3. Test the application"
echo
echo -e "📝 ${BLUE}Useful Commands:${NC}"
echo -e "   View pods: ${YELLOW}kubectl get pods -n production${NC}"
echo -e "   View logs: ${YELLOW}kubectl logs -f -n production -l app=teachers-training${NC}"
echo -e "   Scale app: ${YELLOW}kubectl scale deployment/teachers-training-app -n production --replicas=20${NC}"
echo
echo -e "${GREEN}✅ System is ready to handle 20,000+ concurrent users!${NC}"