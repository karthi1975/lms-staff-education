# Multi-stage Dockerfile for Teachers Training System
# Optimized for production deployment on GCP

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with exact versions
RUN npm ci --only=production && \
    npm rebuild bcrypt --build-from-source && \
    npm cache clean --force

# Copy application code
COPY . .

# Remove unnecessary files
RUN rm -rf .git .env.local .env.development \
    docs tests k8s .specify \
    *.md *.log

# Stage 2: Production stage
FROM node:18-alpine

# Install production dependencies (including build tools for bcrypt)
RUN apk add --no-cache \
    curl \
    tini \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install dependencies in production stage
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code (excluding node_modules from builder)
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/cache /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3000 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "server.js"]