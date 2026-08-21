import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

const DEFAULT_COST = 12;

/**
 * The one place passwords get hashed or verified.
 *
 * bcrypt rather than argon2 so Supabase's existing `auth.users.encrypted_password` hashes
 * stay verifiable if members are migrated — a bcrypt hash carries its own cost factor, so
 * older cost-10 hashes verify fine here and are re-hashed at the next
 * password change.
 */
@Injectable()
export class PasswordHasher {
  private readonly cost: number;

  constructor(config: ConfigService) {
    const configured = Number(config.get<string>('BCRYPT_COST'));
    this.cost = Number.isInteger(configured) && configured >= 4 && configured <= 15 ? configured : DEFAULT_COST;
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Constant-time-ish dummy verification for the "email not found" branch of login, so an
   * unknown email and a wrong password take the same time and return the same error.
   */
  async compareWithDummy(plain: string): Promise<false> {
    await bcrypt.compare(plain, `$2b$${String(this.cost).padStart(2, '0')}$${'.'.repeat(53)}`).catch(() => false);
    return false;
  }
}
