import { Office, User, SpeedTest, TestSchedule, UserRole, TimeSlot } from '@prisma/client';

// ISP interface for unique identification
export interface ISPProvider {
  id: string; // Unique identifier within the office
  name: string; // Display name (e.g., "PLDT")
  description?: string; // Optional description (e.g., "Main Office Connection", "Backup Line")
  section?: string; // Section this ISP belongs to (if applicable)
}

export type UserWithOffice = User & {
  office?: Office | null;
};

export type SpeedTestWithOffice = SpeedTest & {
  office: Office;
};

export type OfficeWithStats = Office & {
  _count: {
    speedTests: number;
    users: number;
  };
  averageDownload?: number;
  averageUpload?: number;
  averagePing?: number;
};

export type SpeedTestData = {
  download: number;
  upload: number;
  ping: number;
  jitter?: number;
  packetLoss?: number;
  serverId?: string;
  serverName?: string;
  serverLocation?: string;
  resultUrl?: string;
  rawData?: string;
  ispName?: string; // ISP detected during the test
  ispValidation?: {
    isMatch: boolean;
    confidence: number;
    detectedCanonical: string;
    selectedCanonical: string;
    suggestion?: string;
  };
};

export type DashboardStats = {
  totalTests: number;
  averageDownload: number;
  averageUpload: number;
  averagePing: number;
  testsToday: number;
  officesCount: number;
};

export type ChartData = {
  date: string;
  download: number;
  upload: number;
  ping: number;
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      officeId?: string;
      office?: Office;
    };
  }

  interface User {
    role: string;
    officeId?: string;
    office?: Office;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string;
    officeId?: string;
    office?: Office;
  }
}

export { UserRole, TimeSlot };
