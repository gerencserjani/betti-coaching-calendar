import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface BookingEmailDetail {
  label: string;
  value: string;
}

export interface BookingEmailButton {
  label: string;
  url: string;
}

export interface BookingEmailProps {
  previewText: string;
  heading: string;
  intro: string;
  detailsHeading: string;
  details: BookingEmailDetail[];
  note?: BookingEmailDetail;
  primaryButton?: BookingEmailButton;
  secondaryButton?: BookingEmailButton;
  helperText?: string;
  footer: string;
}

export function BookingEmail({
  previewText,
  heading,
  intro,
  detailsHeading,
  details,
  note,
  primaryButton,
  secondaryButton,
  helperText,
  footer,
}: BookingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>{heading}</Heading>
          <Text style={styles.text}>{intro}</Text>

          <Section style={styles.card}>
            <Text style={styles.cardHeading}>{detailsHeading}</Text>
            {details.map((detail) => (
              <Text key={detail.label} style={styles.detailRow}>
                <strong>{detail.label}:</strong> {detail.value}
              </Text>
            ))}
          </Section>

          {note && (
            <Section style={styles.noteCard}>
              <Text style={styles.detailRow}>
                <strong>{note.label}:</strong> {note.value}
              </Text>
            </Section>
          )}

          {helperText && <Text style={styles.text}>{helperText}</Text>}

          {(primaryButton || secondaryButton) && (
            <Section style={styles.buttonSection}>
              {primaryButton && (
                <Button href={primaryButton.url} style={styles.buttonPrimary}>
                  {primaryButton.label}
                </Button>
              )}
              {secondaryButton && (
                <Button
                  href={secondaryButton.url}
                  style={styles.buttonSecondary}
                >
                  {secondaryButton.label}
                </Button>
              )}
            </Section>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footerText}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  main: {
    backgroundColor: '#f5f5f4',
    fontFamily: 'Helvetica, Arial, sans-serif',
    padding: '24px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    maxWidth: '480px',
    borderRadius: '12px',
  },
  h1: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 16px',
  },
  text: { fontSize: '15px', color: '#374151', lineHeight: '22px' },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
  },
  cardHeading: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    margin: '0 0 8px',
  },
  noteCard: {
    backgroundColor: '#fef3c7',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '12px',
  },
  detailRow: { fontSize: '14px', color: '#374151', margin: '4px 0' },
  buttonSection: { textAlign: 'center' as const, marginTop: '24px' },
  buttonPrimary: {
    backgroundColor: '#111827',
    color: '#ffffff',
    padding: '12px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    textDecoration: 'none',
    margin: '0 8px',
    display: 'inline-block',
  },
  buttonSecondary: {
    backgroundColor: '#ffffff',
    color: '#111827',
    border: '1px solid #d1d5db',
    padding: '12px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    textDecoration: 'none',
    margin: '0 8px',
    display: 'inline-block',
  },
  hr: { borderColor: '#e5e7eb', marginTop: '32px' },
  footerText: { fontSize: '12px', color: '#9ca3af' },
};
