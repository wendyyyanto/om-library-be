import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from './AuthTypes';

/**
 * The only sanctioned way to learn who is calling. Member-scoped queries derive `user_id`
 * from this — never from a route param or query string.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    return field ? request.user[field] : request.user;
  },
);
