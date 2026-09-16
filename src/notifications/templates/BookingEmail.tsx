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

// Mirrors the frontend's `siteName` (src/content/site.ts) - kept as a
// constant here rather than threaded through as a prop, same as the
// frontend hardcodes it once at the content layer.
const BRAND_NAME = 'Gerencsér Bernadett';
const BRAND_TAGLINE = 'Családi és párkapcsolati coach';

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
      <Head>
        <style>{fontAndDarkModeCss}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.main} className="bcc-body">
        <Container style={styles.container} className="bcc-container">
          <Section style={styles.letterhead} className="bcc-letterhead">
            <Text style={styles.brandName} className="bcc-brand-name">
              {BRAND_NAME}
            </Text>
            <Text style={styles.brandTagline} className="bcc-brand-tagline">
              {BRAND_TAGLINE}
            </Text>
          </Section>

          <Section style={styles.content}>
            <Heading style={styles.h1} className="bcc-h1">
              {heading}
            </Heading>
            <Text style={styles.text} className="bcc-text">
              {intro}
            </Text>

            <Section style={styles.card} className="bcc-card">
              <Text style={styles.cardHeading} className="bcc-card-heading">
                {detailsHeading}
              </Text>
              {details.map((detail) => (
                <Text
                  key={detail.label}
                  style={styles.detailRow}
                  className="bcc-detail"
                >
                  <strong>{detail.label}:</strong> {detail.value}
                </Text>
              ))}
            </Section>

            {note && (
              <Section style={styles.noteCard} className="bcc-note">
                <Text style={styles.detailRow} className="bcc-detail">
                  <strong>{note.label}:</strong> {note.value}
                </Text>
              </Section>
            )}

            {helperText && (
              <Text style={styles.text} className="bcc-text">
                {helperText}
              </Text>
            )}

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
                    className="bcc-button-secondary"
                  >
                    {secondaryButton.label}
                  </Button>
                )}
              </Section>
            )}

            <Hr style={styles.hr} className="bcc-hr" />
            <Text style={styles.footerText} className="bcc-footer">
              {footer}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Brand palette, mirrored from the frontend's CSS custom properties
// (src/index.css `:root` / `[data-theme="light"]` and the dark-mode block).
// Emails can't read CSS variables, so the hex values are duplicated here;
// keep the two in sync if the frontend's palette changes.
const light = {
  bg: '#fbf0f0',
  bgPanel: '#f0dada',
  bgCard: '#fef7f7',
  ink: '#2a1717',
  inkSoft: '#7c5959',
  accent: '#9e5a69',
  accentSoft: '#c99aa0',
  line: '#e9cdcd',
  brown: '#8b6b45',
};

const dark = {
  bg: '#241717',
  bgPanel: '#2e1c1c',
  bgCard: '#331f1f',
  ink: '#f5e1e1',
  inkSoft: '#c99898',
  accent: '#d98ca0',
  accentSoft: '#a15c6b',
  line: '#4a2c2c',
  brown: '#c9a171',
};

// Google Fonts + a light `@import`/`@media` progressive enhancement layer.
// Inline styles below carry the fallback stacks and light-mode colors, so
// clients that strip <style> blocks (older Outlook) still render correctly.
const fontAndDarkModeCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,480;9..144,560&family=Work+Sans:wght@400;500;600&display=swap');

  @media (prefers-color-scheme: dark) {
    .bcc-body { background-color: ${dark.bg} !important; }
    .bcc-container { background-color: ${dark.bg} !important; }
    .bcc-letterhead { background-color: ${dark.bgPanel} !important; border-bottom-color: ${dark.line} !important; }
    .bcc-brand-name { color: ${dark.ink} !important; }
    .bcc-brand-tagline { color: ${dark.inkSoft} !important; }
    .bcc-h1, .bcc-detail strong { color: ${dark.ink} !important; }
    .bcc-text, .bcc-detail { color: ${dark.inkSoft} !important; }
    .bcc-card { background-color: ${dark.bgCard} !important; border-color: ${dark.line} !important; }
    .bcc-card-heading { color: ${dark.brown} !important; }
    .bcc-note { background-color: ${dark.bgPanel} !important; border-color: ${dark.accentSoft} !important; }
    .bcc-hr { border-color: ${dark.line} !important; }
    .bcc-footer { color: ${dark.inkSoft} !important; }
    .bcc-button-secondary { background-color: ${dark.bgCard} !important; color: ${dark.ink} !important; border-color: ${dark.line} !important; }
  }
`;

const serif = '"Fraunces", Georgia, "Times New Roman", serif';
const sans = '"Work Sans", Helvetica, Arial, sans-serif';

const styles = {
  main: {
    backgroundColor: light.bg,
    fontFamily: sans,
    padding: '24px 0',
  },
  container: {
    backgroundColor: light.bg,
    margin: '0 auto',
    maxWidth: '480px',
    borderRadius: '16px',
    overflow: 'hidden',
    border: `1px solid ${light.line}`,
  },
  letterhead: {
    backgroundColor: light.bgPanel,
    padding: '28px 32px 22px',
    textAlign: 'center' as const,
    borderBottom: `1px solid ${light.line}`,
  },
  brandName: {
    fontFamily: serif,
    fontWeight: 480,
    letterSpacing: '-0.01em',
    fontSize: '22px',
    color: light.ink,
    margin: 0,
  },
  brandTagline: {
    fontFamily: sans,
    fontSize: '13px',
    color: light.inkSoft,
    margin: '4px 0 0',
  },
  content: { padding: '32px' },
  h1: {
    fontFamily: serif,
    fontWeight: 480,
    letterSpacing: '-0.01em',
    fontSize: '21px',
    color: light.ink,
    margin: '0 0 16px',
  },
  text: { fontSize: '15px', color: light.inkSoft, lineHeight: '22px' },
  card: {
    backgroundColor: light.bgCard,
    border: `1px solid ${light.line}`,
    borderRadius: '10px',
    padding: '16px',
    marginTop: '16px',
  },
  cardHeading: {
    fontFamily: sans,
    fontSize: '12px',
    fontWeight: 600,
    color: light.brown,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    margin: '0 0 8px',
  },
  noteCard: {
    backgroundColor: light.bgPanel,
    border: `1px solid ${light.accentSoft}`,
    borderRadius: '10px',
    padding: '16px',
    marginTop: '12px',
  },
  detailRow: { fontSize: '14px', color: light.inkSoft, margin: '4px 0' },
  buttonSection: { textAlign: 'center' as const, marginTop: '24px' },
  buttonPrimary: {
    backgroundColor: light.accent,
    color: '#ffffff',
    padding: '12px 22px',
    borderRadius: '999px',
    fontFamily: sans,
    fontWeight: 500,
    fontSize: '14px',
    textDecoration: 'none',
    margin: '0 8px',
    display: 'inline-block',
  },
  buttonSecondary: {
    backgroundColor: light.bgCard,
    color: light.ink,
    border: `1px solid ${light.ink}`,
    padding: '12px 22px',
    borderRadius: '999px',
    fontFamily: sans,
    fontWeight: 500,
    fontSize: '14px',
    textDecoration: 'none',
    margin: '0 8px',
    display: 'inline-block',
  },
  hr: { borderColor: light.line, marginTop: '32px' },
  footerText: { fontSize: '12px', color: light.inkSoft },
};
