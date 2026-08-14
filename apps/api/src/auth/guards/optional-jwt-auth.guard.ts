import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(err: any, user: any): any {
    // If there's an error or no user, treat the request as anonymous
    if (err || !user) {
      return undefined;
    }
    return user as TUser;
  }
}
