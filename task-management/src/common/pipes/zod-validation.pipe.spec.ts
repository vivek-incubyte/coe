import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns the parsed value when it satisfies the schema', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

    expect(pipe.transform({ name: 'Ada' })).toEqual({ name: 'Ada' });
  });

  it('applies schema defaults to the returned value', () => {
    const pipe = new ZodValidationPipe(
      z.object({ count: z.coerce.number().default(1) }),
    );

    expect(pipe.transform({})).toEqual({ count: 1 });
  });

  it('applies schema coercion to the returned value', () => {
    const pipe = new ZodValidationPipe(z.object({ count: z.coerce.number() }));

    expect(pipe.transform({ count: '5' })).toEqual({ count: 5 });
  });

  it('accepts a non-object schema, such as a bare uuid string', () => {
    const pipe = new ZodValidationPipe(z.uuid());

    expect(pipe.transform('123e4567-e89b-12d3-a456-426614174000')).toBe(
      '123e4567-e89b-12d3-a456-426614174000',
    );
  });

  it('throws BadRequestException when the value fails schema validation', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

    expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
  });

  it('throws BadRequestException for a non-object schema given an invalid value', () => {
    const pipe = new ZodValidationPipe(z.uuid());

    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });

  it('carries the zod validation issues in the exception response', () => {
    const pipe = new ZodValidationPipe(z.object({ name: z.string().min(1) }));

    let thrown: unknown;
    try {
      pipe.transform({ name: '' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    const response = (thrown as BadRequestException).getResponse() as {
      message: unknown;
    };
    expect(Array.isArray(response.message)).toBe(true);
    expect(response.message).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['name'] })]),
    );
  });
});
