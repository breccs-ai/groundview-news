import { sendEmail } from '@/lib/email';
import { emailShell } from '@/lib/email-branding';

/**
 * Internal staff alerts to info@groundviewnews.com: new sign-ups (writer
 * applications, reader subscriptions, advertiser accounts) and anything
 * awaiting review (article submissions, journalist application decisions,
 * approaching peer-review deadlines). Uses the same standard signature/footer
 * as every other outgoing email, minus an unsubscribe link — info@ is a
 * shared team inbox, not an individual with a profile to flag opted-out.
 */
export async function notifyOps(subject: string, bodyHtml: string): Promise<void> {
  await sendEmail('info@groundviewnews.com', subject, emailShell(bodyHtml));
}
