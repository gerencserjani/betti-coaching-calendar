import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleOAuthService } from './google-oauth.service.js';

export interface CreateMeetEventInput {
  title: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails: string[];
}

export interface MeetEventResult {
  eventId: string;
  meetLink: string;
}

@Injectable()
export class GoogleCalendarService {
  constructor(private readonly oauthService: GoogleOAuthService) {}

  /**
   * Creates a fresh Google Calendar event with a brand-new Meet room every
   * time, so previous clients can never re-enter or linger in an old room.
   */
  async createMeetEvent(input: CreateMeetEventInput): Promise<MeetEventResult> {
    const auth = await this.oauthService.getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'none',
      requestBody: {
        summary: input.title,
        description: input.description,
        start: { dateTime: input.startAt.toISOString() },
        end: { dateTime: input.endAt.toISOString() },
        attendees: input.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink =
      data.hangoutLink ??
      data.conferenceData?.entryPoints?.find(
        (entry) => entry.entryPointType === 'video',
      )?.uri;

    if (!data.id || !meetLink) {
      throw new Error('Google Calendar did not return a Meet link');
    }

    return { eventId: data.id, meetLink };
  }

  async deleteEvent(eventId: string): Promise<void> {
    const auth = await this.oauthService.getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events
      .delete({ calendarId: 'primary', eventId, sendUpdates: 'none' })
      .catch(() => {
        // Best-effort cleanup; a missing/already-deleted event is not a failure for the caller.
      });
  }
}
