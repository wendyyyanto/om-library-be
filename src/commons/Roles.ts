import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/library';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route or controller to the given roles. Read by `RolesGuard`.
 * BR-5: roles come from the token (and ultimately the DB) only — never from a request body.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
