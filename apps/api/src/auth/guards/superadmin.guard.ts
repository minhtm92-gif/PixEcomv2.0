import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../strategies/jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * SuperadminGuard — extends JwtAuthGuard to additionally require
 * that the authenticated user has isSuperadmin === true.
 *
 * Usage:
 *   @UseGuards(SuperadminGuard)
 *
 * Flow:
 *   1. JwtAuthGuard validates the Bearer token (401 if invalid/missing)
 *   2. JWT strategy populates req.user (with live DB check for isActive)
 *   3. This guard checks req.user.isSuperadmin === true
 *      → false → ForbiddenException (403)
 */
@Injectable()
export class SuperadminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Run JWT validation first — throws 401 if token is invalid
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user?.isSuperadmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    return true;
  }
}
