import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a route (or a whole controller) out of the globally registered `JwtAuthGuard`.
 * The guard fails closed, so an unannotated route requires a token.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
