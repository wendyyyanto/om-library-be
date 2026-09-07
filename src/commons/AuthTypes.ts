import { Request } from 'express';
import { UserRole } from '../constants/library';

/** What `JwtAuthGuard` attaches to the request. Never trust anything else for identity. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/** Signed JWT payload. `sub` is the `library_users.id`. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
