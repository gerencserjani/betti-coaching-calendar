import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Coach } from '@prisma/client';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; coach: Coach }> {
    const coach = await this.prisma.coach.findUnique({ where: { email } });
    if (
      !coach ||
      !(await this.passwordService.compare(password, coach.passwordHash))
    ) {
      // warn, not error -- expected to happen (typos), and it's also the
      // login-brute-force signal an operator would actually want to notice.
      this.logger.warn(`Failed login attempt for ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`Login: ${coach.email} (${coach.id})`);
    const accessToken = this.tokenService.sign({
      sub: coach.id,
      email: coach.email,
      role: coach.role,
    });
    return { accessToken, coach };
  }
}
