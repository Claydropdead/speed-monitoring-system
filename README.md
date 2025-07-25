# Speed Test Monitoring System

A comprehensive internet speed monitoring system built with Next.js, TypeScript, and SQLite. This system allows multiple offices to monitor their internet performance with automated testing and detailed analytics.

## Features

- **Multi-Office Support**: Track internet speed across multiple office locations
- **Automated Testing**: Scheduled speed tests 3 times daily (morning, noon, afternoon)
- **Role-Based Access**: Office users see their own data, admins see all locations
- **Real-time Analytics**: Dashboard with charts and performance metrics
- **Ookla Speedtest Integration**: Uses official Speedtest CLI for accurate measurements
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Production Ready**: Clean production setup without demo data

## 🚀 Quick Start

### Development Mode

```bash
# Clone and install
git clone <repository-url>
cd speed-test-monitoring-system
npm install

# Setup development database
npm run db:push && npm run db:generate && npm run db:seed

# Start development server
npm run dev
```

**Development Admin:** `admin@speedtest.local` / `admin123`

### Production Deployment

```bash
# Setup production environment
npm run setup:production

# Configure your .env file with production values
# Then run: npm run db:setup:production
```

📖 **[Complete Production Setup Guide](./PRODUCTION-SETUP.md)**

## Tech Stack

- **Frontend/Backend**: Next.js 14+ with App Router
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Tailwind CSS with Lucide React icons
- **Charts**: Recharts for data visualization
- **Speed Testing**: Ookla Speedtest CLI
- **Scheduling**: Node-cron for automated tests

## Prerequisites

- Node.js 18+
- npm or yarn
- Ookla Speedtest CLI (optional - falls back to mock data for development)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd speed-test-monitoring-system
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   ```
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-secret-key-here"
   ```

4. **Set up the database**

   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Install Speedtest CLI (required for real speed tests)**

   **Quick Setup (Windows):**

   ```bash
   npm run setup:speedtest
   ```

   **Manual Installation:**

   - Download from https://www.speedtest.net/apps/cli
   - Or use: `winget install Ookla.Speedtest.CLI`
   - Or use: `choco install speedtest`

   **Verify Installation:**

   ```bash
   npm run check:speedtest
   ```

6. **Check system requirements**
   ```bash
   node scripts/check-env.js
   ```

## Running the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

Visit `http://localhost:3000` to access the application.

## Default Accounts

After seeding the database, you can log in with:

**Admin Account:**

- Email: `admin@speedtest.com`
- Password: `admin123`

**Office Accounts:**

- New York: `newyork@speedtest.com` / `ny123`
- Los Angeles: `losangeles@speedtest.com` / `la123`
- Chicago: `chicago@speedtest.com` / `ch123`

## Database Schema

The system uses the following main models:

- **Users**: Authentication and role management
- **Offices**: Office locations with ISP information
- **SpeedTests**: Test results with download/upload/ping data
- **TestSchedules**: Automated test scheduling configuration

## API Endpoints

- `GET /api/speedtest` - Fetch speed test results
- `POST /api/speedtest` - Run a new speed test
- `GET /api/offices` - Get office information
- `POST /api/offices` - Create new office (admin only)
- `GET /api/dashboard/stats` - Dashboard statistics

## Features in Detail

### Automated Testing

- Tests run 3 times daily at 9 AM, 12 PM, and 3 PM
- Configurable timezone support
- Automatic retry on failure
- Results stored with timestamp and metadata

### Dashboard Analytics

- Real-time performance metrics
- Historical data visualization
- Office comparison charts
- Speed trend analysis

### User Management

- Role-based access control
- Office-specific data isolation
- Admin oversight capabilities
- Secure authentication with NextAuth.js

## Development

### Database Operations

```bash
# Push schema changes
npm run db:push

# Reset database with seed data
npm run db:seed

# Generate Prisma client
npm run db:generate
```

### Adding New Features

The codebase follows Next.js App Router conventions:

- API routes in `src/app/api/`
- Pages in `src/app/`
- Components in `src/components/`
- Utilities in `src/lib/`
- Types in `src/types/`

## Deployment

### Railway Deployment (Recommended)

Railway automatically handles Speedtest CLI installation and PostgreSQL setup:

1. **Prepare for Railway**
   ```bash
   # Your app is already configured with:
   # - Dockerfile for Speedtest CLI installation
   # - PostgreSQL-compatible Prisma schema
   # - Railway configuration files
   ```

2. **Deploy to Railway**
   - Push your code to GitHub
   - Connect your GitHub repo to Railway
   - Add PostgreSQL service (Railway auto-generates DATABASE_URL)
   - Set environment variables:
     ```
     NEXTAUTH_URL=https://your-app-name.railway.app
     NEXTAUTH_SECRET=your-generated-secret
     NODE_ENV=production
     ```

3. **Post-deployment**
   ```bash
   # Railway will automatically:
   # - Install Ookla Speedtest CLI
   # - Set up PostgreSQL database
   # - Run database migrations
   # - Build and start your app
   ```

### Manual Deployment

1. **Build the application**

   ```bash
   npm run build
   ```

2. **Set up production database**

   - Configure `DATABASE_URL` for production
   - Run migrations and seed data

3. **Deploy to your preferred platform**
   - Vercel, Netlify, or any Node.js hosting service
   - Ensure Speedtest CLI is available on the deployment platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.
