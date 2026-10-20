import { Injectable } from '@nestjs/common';
import { escapeHtml } from '../common/html.util.js';
import { EmailService } from '../notifications/email.service.js';

/**
 * Deliberately plain, same reasoning as CoachInviteEmailService -- the
 * recipient here is the coach herself, not a client, so there's no
 * business identity to present.
 */
@Injectable()
export class PasswordResetEmailService {
  constructor(private readonly emailService: EmailService) {}

  async sendReset(
    email: string,
    name: string,
    frontendUrl: string,
    token: string,
  ): Promise<void> {
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 20px;">Jelszó visszaállítása</h1>
        <p>Szia ${escapeHtml(name)}!</p>
        <p>Új jelszót kértél a fiókodhoz. Az alábbi linkre kattintva állíthatsz be egy újat:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #1a1a1f; color: #fff; text-decoration: none; border-radius: 6px;">
            Új jelszó beállítása
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          Ha a gomb nem működik, másold be ezt a linket a böngésződbe: ${resetUrl}
        </p>
        <p style="color: #666; font-size: 13px;">A link 1 óráig érvényes. Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt az emailt.</p>
      </div>
    `;

    await this.emailService.sendRaw({
      to: email,
      subject: 'Jelszó visszaállítása',
      html,
    });
  }
}
