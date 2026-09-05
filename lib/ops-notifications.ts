import { sendEmail } from '@/lib/email';

/**
 * Internal staff alerts to info@groundviewnews.com: new sign-ups (writer
 * applications, reader subscriptions, advertiser accounts) and anything
 * awaiting review (article submissions, journalist application decisions,
 * approaching peer-review deadlines). Plain and scannable on purpose — this
 * is an ops inbox, not a message to a member of the public, so it skips the
 * branded shell/signature/footer used for external emails.
 */
export async function notifyOps(subject: string, bodyHtml: string): Promise<void> {
  await sendEmail('info@groundviewnews.com', subject, bodyHtml);
}
