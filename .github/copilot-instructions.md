# Copilot Instructions for Speed Test Monitoring System

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a Speed Test Monitoring System built with Next.js and TypeScript. The system monitors internet speed tests for multiple offices with different ISPs and locations.

## Key Technologies
- **Frontend/Backend**: Next.js 14+ with App Router
- **Database**: SQLite with Prisma ORM
- **Authentication**: NextAuth.js for multi-tenant user management
- **UI**: Tailwind CSS with modern, responsive design
- **Speed Testing**: Ookla Speedtest CLI integration
- **Scheduling**: Built-in scheduler for automated speed tests

## Architecture Guidelines
- Use TypeScript for all code files
- Follow Next.js App Router patterns
- Implement multi-tenant architecture for office separation
- Use Prisma for database operations
- Follow REST API conventions for endpoints
- Implement proper error handling and validation
- Use server actions where appropriate for form handling

## Database Schema
- Users table (with office association and roles)
- Offices table (with ISP and location info)
- SpeedTests table (with download, upload, ping, jitter data)
- TestSchedules table (for managing 3x daily test requirements)

## Security Considerations
- Implement proper authentication and authorization
- Use environment variables for sensitive data
- Validate all user inputs
- Implement rate limiting for API endpoints
- Separate admin and office user permissions

## UI/UX Guidelines
- Modern, clean dashboard design
- Responsive layout for mobile and desktop
- Data visualization with charts and graphs
- Real-time updates for speed test results
- Clear navigation between office and admin views

## Code Style
- Use functional components with hooks
- Implement proper TypeScript interfaces
- Follow Next.js file-based routing conventions
- Use server components where possible for better performance
- Implement proper loading states and error boundaries
