import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { resolveRequestOrigin } from '../common/origin.util.js';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Tighter than the app default: login has no account lockout, so this is
  // the only thing standing between a leaked/guessed password and a brute
  // force attempt.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // Same response (204, no body) whether or not the email has an account --
  // see AuthService.forgotPassword()'s own comment for why.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(204)
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('origin') origin?: string,
    @Headers('referer') referer?: string,
  ) {
    return this.authService.forgotPassword(
      dto.email,
      resolveRequestOrigin(origin, referer),
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
