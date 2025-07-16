# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Install system dependencies required for Speedtest CLI
RUN apk add --no-cache \
    wget \
    curl \
    bash \
    ca-certificates

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Install Ookla Speedtest CLI
RUN wget -O speedtest.tgz "https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-$(uname -m).tgz" \
    && tar -xzf speedtest.tgz \
    && mv speedtest /usr/local/bin/ \
    && rm speedtest.tgz \
    && chmod +x /usr/local/bin/speedtest

# Accept Speedtest license (non-interactive)
RUN speedtest --accept-license --accept-gdpr --version || true

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Generate Prisma client
RUN npx prisma generate

# Build the application (skip DB operations during build)
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
RUN npm run build:docker

# Note: Keeping all dependencies for runtime CSS processing

# Remove dev dependencies after build
RUN npm prune --production

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["./start.sh"]
