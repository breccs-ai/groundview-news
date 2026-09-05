const DEFAULT_FROM = 'Ground View News <noreply@groundviewnews.com>';

/**
 * Returns whether the send actually succeeded. Existing callers that treat
 * email as best-effort and don't check the return value are unaffected —
 * this never throws — but callers that need to know (e.g. a bulk-send script
 * reporting results) can check it instead of assuming success.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from: string = DEFAULT_FROM,
  headers?: Record<string, string>
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return false;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      ...(headers ? { headers } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
    return false;
  }
  return true;
}
