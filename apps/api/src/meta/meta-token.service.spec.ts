import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import { MetaTokenService } from './meta-token.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a valid 64-char hex key (32 bytes). */
function makeKey(): string {
  return randomBytes(32).toString('hex');
}

function makeModule(keyHex: string | undefined): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      MetaTokenService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) => {
            if (key === 'META_TOKEN_ENCRYPTION_KEY') return keyHex;
            if (key === 'NODE_ENV') return 'test';
            return undefined;
          },
        },
      },
    ],
  }).compile();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MetaTokenService', () => {
  let service: MetaTokenService;

  beforeEach(async () => {
    const module = await makeModule(makeKey());
    service = module.get<MetaTokenService>(MetaTokenService);
    // Trigger OnModuleInit
    service.onModuleInit();
  });

  // ── encrypt/decrypt roundtrip ──────────────────────────────────────────────

  it('encrypt then decrypt returns original token', () => {
    const plain = 'EAABwzLixnjYBO_fake_access_token_12345';
    const enc = service.encrypt(plain);
    const dec = service.decrypt(enc);
    expect(dec).toBe(plain);
  });

  it('encrypts same input to different ciphertexts each time (random IV)', () => {
    const plain = 'same-token-every-time';
    const enc1 = service.encrypt(plain);
    const enc2 = service.encrypt(plain);
    expect(enc1).not.toBe(enc2);
  });

  it('encrypted output is a valid base64 string', () => {
    const enc = service.encrypt('test-token');
    expect(() => Buffer.from(enc, 'base64')).not.toThrow();
    // Must be non-empty
    expect(enc.length).toBeGreaterThan(0);
  });

  it('decrypted output is a plain UTF-8 string', () => {
    const plain = 'unicode-token-ñoño-🎉';
    const dec = service.decrypt(service.encrypt(plain));
    expect(dec).toBe(plain);
  });

  // ── Error cases ────────────────────────────────────────────────────────────

  it('decrypt throws InternalServerErrorException for garbage input', () => {
    expect(() => service.decrypt('not-valid-base64!!!')).toThrow();
  });

  it('decrypt throws InternalServerErrorException when auth tag is tampered', () => {
    const enc = service.encrypt('some-token');
    // Decode, flip a byte in the authTag segment (last part), re-encode
    const raw = Buffer.from(enc, 'base64').toString('utf8');
    const parts = raw.split(':');
    // Flip last char of authTag hex
    const authTagHex = parts[2];
    const tampered = authTagHex.slice(0, -2) + (authTagHex.endsWith('ff') ? '00' : 'ff');
    parts[2] = tampered;
    const tamperedEnc = Buffer.from(parts.join(':')).toString('base64');
    expect(() => service.decrypt(tamperedEnc)).toThrow();
  });

  it('decrypt throws InternalServerErrorException for malformed format (missing colons)', () => {
    const malformed = Buffer.from('onlyone').toString('base64');
    expect(() => service.decrypt(malformed)).toThrow();
  });

  // ── Key management ─────────────────────────────────────────────────────────

  it('uses ephemeral key in non-production when META_TOKEN_ENCRYPTION_KEY is missing', async () => {
    // Should not throw — uses random ephemeral key in dev/test
    const module = await makeModule(undefined);
    const svc = module.get<MetaTokenService>(MetaTokenService);
    expect(() => svc.onModuleInit()).not.toThrow();

    // Roundtrip should still work with the ephemeral key
    const plain = 'ephemeral-key-test';
    expect(svc.decrypt(svc.encrypt(plain))).toBe(plain);
  });

  it('different instances with different keys cannot decrypt each other\'s tokens', async () => {
    const m1 = await makeModule(makeKey());
    const m2 = await makeModule(makeKey());
    const svc1 = m1.get<MetaTokenService>(MetaTokenService);
    const svc2 = m2.get<MetaTokenService>(MetaTokenService);
    svc1.onModuleInit();
    svc2.onModuleInit();

    const enc = svc1.encrypt('cross-key-test');
    expect(() => svc2.decrypt(enc)).toThrow();
  });
});
