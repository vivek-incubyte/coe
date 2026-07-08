import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(ForbiddenException)
export class ForbiddenToUnauthorizedFilter implements ExceptionFilter {
  catch(_exception: ForbiddenException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const unauthorized = new UnauthorizedException();

    response.status(unauthorized.getStatus()).json(unauthorized.getResponse());
  }
}
