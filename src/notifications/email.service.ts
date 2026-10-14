import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/configuration.js';
import type { BookingEmailProps } from './templates/BookingEmail.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  props: BookingEmailProps;
  icsContent?: string;
  icsFilename?: string;
}

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const { gmail, emailFrom } = this.configService.get<AppConfig>('app')!;
    // Sends through Gmail's own SMTP, authenticated as a real Gmail account
    // (an "App Password", not the account password) - unlike a third-party
    // email API, this is allowed to claim a @gmail.com From address because
    // it's genuinely Google's own servers sending it.
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmail.user, pass: gmail.appPassword },
    });
    this.from = emailFrom;
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

    await this.transporter.sendMail({
      from: this.from,
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
}
