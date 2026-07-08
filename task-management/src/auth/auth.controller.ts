import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PublicUser, UserResponseDto } from '../users/user.schema';
import { AuthService } from './auth.service';
import { LoginSchema, RegisterSchema } from './auth.schema';
import type { LoginDto, RegisterDto } from './auth.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) registerDto: RegisterDto,
  ): Promise<UserResponseDto> {
    const user = await this.authService.register(registerDto);
    return this.toResponseDto(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) loginDto: LoginDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(loginDto);
  }

  private toResponseDto(user: PublicUser): UserResponseDto {
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
