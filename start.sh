#!/bin/bash
set -e

echo "🚀 Starting Speed Test Monitoring System..."

# Set timezone if not specified
if [ -z "$TZ" ]; then
  export TZ="UTC"
  echo "🌍 Timezone set to UTC (default for Railway)"
else
  echo "🌍 Timezone set to $TZ"
fi

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
timeout=30
counter=0
until npx prisma db push --force-reset 2>/dev/null || [ $counter -eq $timeout ]; do
  echo "Database not ready yet. Waiting... ($counter/$timeout)"
  sleep 1
  counter=$((counter + 1))
done

if [ $counter -eq $timeout ]; then
  echo "❌ Database connection timeout. Exiting."
  exit 1
fi

echo "✅ Database connection established"

# Run database setup
echo "📊 Setting up database schema..."
npx prisma db push --force-reset

echo "🌱 Seeding database with admin user..."
npm run db:seed:prod

echo "🎉 Database setup complete!"
echo "🔐 Admin credentials: admin@speedtest.local / admin123"

# Start the application
echo "🚀 Starting Next.js application..."
exec npm start
