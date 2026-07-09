import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthToken } from '../../src/auth/auth.guard';

type DecodedToken = AuthToken & { exp: number; iat: number };

describe('JWT module configuration', () => {
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
    }).compile();

    jwtService = module.get<JwtService>(JwtService);
  });

  it('issues tokens that expire exactly 1 hour (3600 seconds) after issuance', () => {
    const payload: AuthToken = {
      sub: 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
      email: 'test@example.com',
    };

    const token = jwtService.sign(payload);
    const decoded = jwtService.decode<DecodedToken>(token);

    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it('round-trips the signed payload unchanged', () => {
    const payload: AuthToken = {
      sub: 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
      email: 'test@example.com',
    };

    const token = jwtService.sign(payload);
    const decoded = jwtService.decode<DecodedToken>(token);

    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
  });
});
