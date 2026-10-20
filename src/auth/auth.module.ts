import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordResetEmailService } from './password-reset-email.service.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    AuthService,
    PasswordResetEmailService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PasswordService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
