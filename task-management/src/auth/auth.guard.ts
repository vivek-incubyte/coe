import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { PublicUser } from 'src/users/user.schema';

export type AuthToken = {
  sub: string;
  email: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return false;
    }

    const token = authHeader.split(' ');

    if (token[0] !== 'Bearer') {
      return false;
    }

    let decodedToken: AuthToken;
    try {
      decodedToken = await this.jwtService.verifyAsync<AuthToken>(token[1]);
    } catch (_err) {
      return false;
    }

    if (!decodedToken) {
      return false;
    }

    const userInfo: PublicUser | null = await this.userService.findById(
      decodedToken.sub,
    );

    if (!userInfo) {
      return false;
    }

    request.user = userInfo;

    return true;
  }
}
