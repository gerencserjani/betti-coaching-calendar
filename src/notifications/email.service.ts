import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../config/configuration.js';
import {
  BookingEmail,
  type BookingEmailProps,
} from './templates/BookingEmail.js';

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
