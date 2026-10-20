import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { calendar as createCalendarClient } from '@googleapis/calendar';
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
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly oauthService: GoogleOAuthService) {}

  /**
   * Creates a fresh Google Calendar event with a brand-new Meet room every
   * time, so previous clients can never re-enter or linger in an old room.
   */
  async createMeetEvent(
    coachId: string,
    input: CreateMeetEventInput,
  ): Promise<MeetEventResult> {
    const auth = await this.oauthService.getAuthenticatedClient(coachId);
    const calendar = createCalendarClient({ version: 'v3', auth });

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

    this.logger.log(`Created Meet event ${data.id} for coach ${coachId}`);
    return { eventId: data.id, meetLink };
  }

  async deleteEvent(coachId: string, eventId: string): Promise<void> {
    const auth = await this.oauthService.getAuthenticatedClient(coachId);
    const calendar = createCalendarClient({ version: 'v3', auth });
    await calendar.events
      .delete({ calendarId: 'primary', eventId, sendUpdates: 'none' })
      .then(() => {
        this.logger.log(`Deleted Meet event ${eventId} for coach ${coachId}`);
      })
      .catch((error) => {
        // Best-effort cleanup; a missing/already-deleted event is not a
        // failure for the caller, but worth a log line -- otherwise a
        // genuinely failed cleanup (vs. an already-gone event) leaves no trace.
        this.logger.warn(
          `Could not delete Meet event ${eventId} for coach ${coachId}: ${error instanceof Error ? error.message : error}`,
        );
      });
  }
}
