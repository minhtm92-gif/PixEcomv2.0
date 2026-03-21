import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;  // 128-bit auth tag — GCM default
const KEY_HEX_LEN = 64; // 32 bytes = 64 hex chars

/**
 * Store format (base64 of colon-separated hex segments):
 *   base64( hex(iv) : hex(ciphertext) : hex(authTag) )
 *
 * This keeps the stored value printable (base64) while allowing easy
 * extraction of each component by splitting on ':'.
 */

// ─── MetaTokenService ─────────────────────────────────────────────────────────

@Injectable()
export class MetaTokenService implements OnModuleInit {
  private readonly logger = new Logger(MetaTokenService.name);
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const keyHex = this.config.get<string>('META_TOKEN_ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== KEY_HEX_LEN) {
      // In development we generate a throwaway key and warn.
      // In production (NODE_ENV=production) we throw hard.
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new InternalServerErrorException(
          'META_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)',
        );
      }
      this.logger.warn(
        'META_TOKEN_ENCRYPTION_KEY not set or invalid — using ephemeral key (DEV ONLY)',
      );
      this.key = randomBytes(32);
    } else {
      this.key = Buffer.from(keyHex, 'hex');
    }
  }

  /**
   * Encrypt a plain FB access token.
   * Returns a base64-encoded string safe for storage in VARCHAR columns.
   */
  encrypt(plainToken: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plainToken, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Store as base64(ivHex:ciphertextHex:authTagHex)
    const payload = [
      iv.toString('hex'),
      ciphertext.toString('hex'),
      authTag.toString('hex'),
    ].join(':');

    return Buffer.from(payload).toString('base64');
  }

  /**
   * Decrypt a stored token back to the plain FB access token.
   * Throws InternalServerErrorException on any decryption failure.
   */
  decrypt(encToken: string): string {
    try {
      const payload = Buffer.from(encToken, 'base64').toString('utf8');
      const parts = payload.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid format: expected 3 colon-separated hex parts');
      }

      const [ivHex, ciphertextHex, authTagHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      if (iv.length !== IV_BYTES) {
        throw new Error(`IV must be ${IV_BYTES} bytes`);
      }
      if (authTag.length !== TAG_BYTES) {
        throw new Error(`Auth tag must be ${TAG_BYTES} bytes`);
      }

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      const plain = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return plain.toString('utf8');
    } catch (err) {
      this.logger.error('Token decryption failed', err);
      throw new InternalServerErrorException('Failed to decrypt Meta access token');
    }
  }
}
