import { Request } from 'express';
import { UserRole } from '../constants/library';
import { MobileUserEntity } from '../entities/MobileUserEntity';

/** What `JwtAuthGuard` attaches to the request. Never trust anything else for identity. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

/** Signed JWT payload. `sub` is the `library_users.id`. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  /** Identifies the server-side refresh session that issued this access token. */
  sid: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  /** Set instead of `user` on `@AllowMobile()` routes called with `Platform: Mobile`. */
  mobileUser?: MobileUserEntity;
}
