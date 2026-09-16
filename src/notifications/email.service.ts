import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { Resend } from 'resend';
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
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const { resend } = this.configService.get<AppConfig>('app')!;
    this.resend = new Resend(resend.apiKey);
    this.from = resend.emailFrom;
  }

  async send(input: SendEmailInput): Promise<void> {
    const html = await render(BookingEmail(input.props));

    await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html,
      attachments: input.icsContent
        ? [
            {
              filename: input.icsFilename ?? 'booking.ics',
              content: Buffer.from(input.icsContent).toString('base64'),
            },
          ]
        : undefined,
    });
  }
}
