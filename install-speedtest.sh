#!/bin/bash
# Install Ookla Speedtest CLI on Railway

set -e  # Exit on any error

echo "Installing Ookla Speedtest CLI..."

# Update package lists
apt-get update -qq

# Install required dependencies
apt-get install -y wget gnupg apt-transport-https

# Add Ookla repository
wget -qO - https://packagecloud.io/ookla/speedtest-cli/gpgkey | apt-key add -
echo "deb https://packagecloud.io/ookla/speedtest-cli/ubuntu/ focal main" > /etc/apt/sources.list.d/speedtest.list

# Update package lists with new repository
apt-get update -qq

# Install speedtest CLI
apt-get install -y speedtest

# Verify installation
echo "Verifying Speedtest CLI installation..."
speedtest --version

# Accept license and GDPR on first run (non-interactive)
echo "Setting up Speedtest CLI..."
speedtest --accept-license --accept-gdpr --format=json > /dev/null 2>&1 || true

echo "Speedtest CLI installation completed successfully!"
