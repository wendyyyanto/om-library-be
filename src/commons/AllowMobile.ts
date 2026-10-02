import { SetMetadata } from '@nestjs/common';

export const ALLOW_MOBILE_KEY = 'allowMobile';

/**
 * Let `JwtAuthGuard` accept a mobile magic-link JWT on this route when the request sends
 * `Platform: Mobile`. The guard attaches the account as `request.mobileUser`, not `request.user`.
 */
export const AllowMobile = (): MethodDecorator => SetMetadata(ALLOW_MOBILE_KEY, true);
