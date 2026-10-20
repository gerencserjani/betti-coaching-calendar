import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import type { AppConfig } from '../config/configuration.js';
import type { BookingEmailProps } from './templates/BookingEmail.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  props: BookingEmailProps;
  icsContent?: string;
  icsFilename?: string;
  /**
   * This tenant's verified Resend sender identity (Settings.emailFrom),
   * resolved by the caller. Null/undefined means this tenant hasn't
   * verified a domain in Resend yet, so this send falls back to the
   * shared Gmail sender below (see class doc).
   */
  from?: string | null;
}

/**
 * Sends through one of two mechanisms, chosen per send by whether a
 * tenant-specific `from` is passed in:
 *
 * - Resend, once a tenant has verified its own sending domain (see
 *   Settings.emailFrom, set via PATCH /settings) -- lets that tenant send
 *   as its own business, not a shared Gmail address.
 * - Gmail SMTP (nodemailer + App Password) -- the original mechanism,
 *   still the fallback for every tenant that hasn't verified a Resend
 *   domain yet, so email sending keeps working through that transition.
 *   Allowed to claim a @gmail.com From address because it's genuinely
 *   Google's own servers sending it; this isn't available for a tenant's
 *   own custom domain, which is exactly why Resend exists (see #13).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly gmailFrom: string;
  private readonly resend?: Resend;

  constructor(private readonly configService: ConfigService) {
    const { gmail, emailFrom, resendApiKey } =
      this.configService.get<AppConfig>('app')!;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmail.user, pass: gmail.appPassword },
    });
    this.gmailFrom = emailFrom;
    this.resend = resendApiKey ? new Resend(resendApiKey) : undefined;
  }

  async send(input: SendEmailInput): Promise<void> {
    // Dynamic import, not a top-level one: @react-email/render pulls in a
    // full React renderer, which is only ever needed once an email is
    // actually about to go out (async, off a cold start's critical path) --
    // loading it eagerly at module scope was adding real time to every cold
    // start for every request, not just the ones that send mail.
    const [{ render }, { BookingEmail }] = await Promise.all([
      import('@react-email/render'),
      import('./templates/BookingEmail.js'),
    ]);
    const html = await render(BookingEmail(input.props));

    if (input.from) {
      await this.sendViaResend(input.from, input, html);
      return;
    }

    await this.transporter.sendMail({
      from: this.gmailFrom,
      to: input.to,
      subject: input.subject,
      html,
      attachments: input.icsContent
        ? [
            {
              filename: input.icsFilename ?? 'booking.ics',
              content: input.icsContent,
              contentType: 'text/calendar',
            },
          ]
        : undefined,
    });
  }

  private async sendViaResend(
    from: string,
    input: SendEmailInput,
    html: string,
  ): Promise<void> {
    if (!this.resend) {
      // Settings.emailFrom was set (presumably after verifying a domain in
      // Resend's dashboard) but RESEND_API_KEY was never configured -- fail
      // loudly rather than silently falling back to Gmail and sending from
      // the wrong address.
      throw new Error(
        `Settings.emailFrom is set to "${from}" but RESEND_API_KEY is not configured`,
      );
    }
    const { error } = await this.resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html,
      attachments: input.icsContent
        ? [
            {
              filename: input.icsFilename ?? 'booking.ics',
              content: Buffer.from(input.icsContent, 'utf8'),
            },
          ]
        : undefined,
    });
    if (error) {
      this.logger.error(`Resend send failed (from ${from})`, error);
      throw new Error(`Resend send failed: ${error.message}`);
    }
  }
}
