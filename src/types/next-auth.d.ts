import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      officeId?: string;
      office?: {
        id: string;
        unitOffice: string;
        subUnitOffice?: string | null;
        isp: string;
        location: string;
        parentId?: string | null;
      } | null;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    role: string;
    officeId?: string;
    office?: {
      id: string;
      unitOffice: string;
      subUnitOffice?: string | null;
      isp: string;
      location: string;
      parentId?: string | null;
    } | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string;
    officeId?: string;
    office?: {
      id: string;
      unitOffice: string;
      subUnitOffice?: string | null;
      isp: string;
      location: string;
      parentId?: string | null;
    } | null;
  }
}
