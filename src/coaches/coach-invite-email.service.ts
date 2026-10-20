import { Injectable } from '@nestjs/common';
import { escapeHtml } from '../common/html.util.js';
import { EmailService } from '../notifications/email.service.js';

/**
 * Deliberately plain, not coach-branded -- the recipient here is the coach
 * herself, not one of her clients, so there's no business identity to
 * present. Coach-branded client-facing emails are a separate, open design
 * question (see backend issue #33); this one ships simple on purpose.
 */
@Injectable()
export class CoachInviteEmailService {
  constructor(private readonly emailService: EmailService) {}

  async sendInvite(
    email: string,
    name: string,
    frontendUrl: string,
    token: string,
  ): Promise<void> {
    const acceptUrl = `${frontendUrl}/accept-invite?token=${encodeURIComponent(token)}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h1 style="font-size: 20px;">Meghívó</h1>
        <p>Szia ${escapeHtml(name)}!</p>
        <p>Létrehoztunk neked egy fiókot. A jelszavad beállításához kattints az alábbi linkre:</p>
        <p>
          <a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; background: #1a1a1f; color: #fff; text-decoration: none; border-radius: 6px;">
            Jelszó beállítása
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          Ha a gomb nem működik, másold be ezt a linket a böngésződbe: ${acceptUrl}
        </p>
        <p style="color: #666; font-size: 13px;">A link 7 napig érvényes.</p>
      </div>
    `;

    await this.emailService.sendRaw({
      to: email,
      subject: 'Meghívó a fiókod beállításához',
      html,
    });
  }
}
