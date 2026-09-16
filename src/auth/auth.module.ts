import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    PasswordService,
    TokenService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PasswordService, TokenService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
