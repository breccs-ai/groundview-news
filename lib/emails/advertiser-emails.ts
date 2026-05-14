const FROM = 'Ground View News <info@groundviewnews.com>';
const SITE = 'https://groundviewnews.com';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapBody(inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
<tr><td style="padding:24px 28px 8px 28px;border-bottom:1px solid #e5e7eb;">
<a href="${SITE}" style="text-decoration:none;color:#0f1f3d;font-weight:700;font-size:22px;letter-spacing:-0.02em;">Ground View <span style="color:#b8860b;">News</span></a>
</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6;">
${inner}
</td></tr>
<tr><td style="padding:16px 28px 24px 28px;font-size:12px;line-height:1.5;color:#64748b;border-top:1px solid #e5e7eb;background:#fafafa;">
<p style="margin:0 0 8px 0;">Ground View News is operated by <strong>Breccs Private Limited</strong> (United Kingdom).</p>
<p style="margin:0;">This email relates to your advertiser account. If you did not expect it, contact <a href="mailto:info@groundviewnews.com" style="color:#0f1f3d;">info@groundviewnews.com</a>.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

async function sendResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[advertiser-emails] RESEND_API_KEY not set — skip');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    console.error('[advertiser-emails] Resend error', res.status, await res.text());
  }
}

export async function kyc_approved(advertiserName: string, email: string): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your Ground View News advertiser account is verified',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your identity verification (KYC) is complete. Your Ground View News advertiser account is now verified.</p>
<p>You can create your first advertisement from your dashboard.</p>
<p><a href="${SITE}/advertiser/create-ad" style="display:inline-block;background:#0f1f3d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Create an advertisement</a></p>
<p><a href="${SITE}/advertiser/dashboard" style="color:#0f1f3d;">Go to advertiser dashboard</a></p>`
    )
  );
}

export async function kyc_failed(advertiserName: string, email: string, reason?: string): Promise<void> {
  const name = escapeHtml(advertiserName);
  const r = reason ? `<p><strong>Details:</strong> ${escapeHtml(reason)}</p>` : '';
  await sendResend(
    email,
    'Identity verification unsuccessful — action required',
    wrapBody(
      `<p>Hello ${name},</p>
<p>We could not complete your identity verification. This can happen if a document was unclear or additional information is required.</p>
${r}
<p>Please retry verification from your advertiser dashboard.</p>
<p><a href="${SITE}/advertiser/dashboard" style="display:inline-block;background:#b45309;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Retry verification</a></p>`
    )
  );
}

export async function ad_live(
  advertiserName: string,
  email: string,
  adTitle: string,
  format: string,
  tier: string,
  startsAt: string,
  expiresAt: string,
  destinationUrl: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your ad is live on Ground View News',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your advertisement <strong>${escapeHtml(adTitle)}</strong> is now live.</p>
<ul style="padding-left:20px;margin:12px 0;">
<li><strong>Format:</strong> ${escapeHtml(format)}</li>
<li><strong>Tier:</strong> ${escapeHtml(tier)}</li>
<li><strong>Live from:</strong> ${escapeHtml(startsAt)} (UTC)</li>
<li><strong>Expires:</strong> ${escapeHtml(expiresAt)} (UTC)</li>
<li><strong>Destination:</strong> <a href="${escapeHtml(destinationUrl)}" style="color:#0f1f3d;word-break:break-all;">${escapeHtml(destinationUrl)}</a></li>
</ul>
<p><a href="${SITE}/advertiser/dashboard" style="display:inline-block;background:#0f1f3d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">View performance</a></p>`
    )
  );
}

export async function ad_rejected(advertiserName: string, email: string, adTitle: string, reason: string): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your advertisement could not be approved',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your advertisement <strong>${escapeHtml(adTitle)}</strong> could not be approved after automated content review.</p>
<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p>Your payment has been refunded to the original payment method. Refunds typically appear within 5–10 business days.</p>
<p>Please revise your creative or destination URL and submit a new advertisement when you are ready.</p>
<p><a href="${SITE}/advertiser/create-ad" style="display:inline-block;background:#0f1f3d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Create a new ad</a></p>`
    )
  );
}

export async function ad_expiry_reminder(
  advertiserName: string,
  email: string,
  adTitle: string,
  expiresAt: string,
  daysRemaining: number,
  renewUrl: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    `Your Ground View News ad expires in ${daysRemaining} days`,
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your advertisement <strong>${escapeHtml(adTitle)}</strong> expires on <strong>${escapeHtml(expiresAt)}</strong> (UTC).</p>
<p>You have <strong>${daysRemaining}</strong> day${daysRemaining === 1 ? '' : 's'} remaining. Renew or resubmit to keep your placement.</p>
<p><a href="${escapeHtml(renewUrl)}" style="display:inline-block;background:#b8860b;color:#1a1a1a;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Renew or resubmit</a></p>
<p style="font-size:14px;color:#64748b;">Renewing stops these expiry reminders for this campaign.</p>`
    )
  );
}

export async function ad_expired(advertiserName: string, email: string, adTitle: string): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your Ground View News advertisement has expired',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your advertisement <strong>${escapeHtml(adTitle)}</strong> has ended and is no longer being served.</p>
<p>You can create a new advertisement at any time.</p>
<p><a href="${SITE}/advertiser/create-ad" style="display:inline-block;background:#0f1f3d;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Create a new ad</a></p>`
    )
  );
}

export async function renewal_confirmed(
  advertiserName: string,
  email: string,
  adTitle: string,
  tier: string,
  nextBillingDate: string,
  amount: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your Ground View News ad has been renewed',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your subscription for <strong>${escapeHtml(adTitle)}</strong> has renewed successfully.</p>
<ul style="padding-left:20px;">
<li><strong>Tier:</strong> ${escapeHtml(tier)}</li>
<li><strong>Next billing date:</strong> ${escapeHtml(nextBillingDate)} (UTC)</li>
<li><strong>Amount charged:</strong> ${escapeHtml(amount)}</li>
</ul>
<p>Manage or cancel from your dashboard.</p>
<p><a href="${SITE}/advertiser/dashboard" style="color:#0f1f3d;font-weight:600;">Open advertiser dashboard</a></p>`
    )
  );
}

export async function payment_failed(
  advertiserName: string,
  email: string,
  adTitle: string,
  updatePaymentUrl: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Payment failed — your Ground View News ad has been paused',
    wrapBody(
      `<p>Hello ${name},</p>
<p>We could not collect payment for <strong>${escapeHtml(adTitle)}</strong>. Your advertisement has been paused until payment succeeds.</p>
<p><a href="${escapeHtml(updatePaymentUrl)}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Update payment method</a></p>
<p>Once payment succeeds, your ad can resume according to your plan.</p>`
    )
  );
}

export async function subscription_cancelled(
  advertiserName: string,
  email: string,
  adTitle: string,
  endsAt: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your Ground View News subscription has been cancelled',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your subscription for <strong>${escapeHtml(adTitle)}</strong> has been cancelled as requested.</p>
<p>Your ad remains active until the end of the current billing period: <strong>${escapeHtml(endsAt)}</strong> (UTC).</p>
<p>You may resubscribe from your dashboard at any time.</p>
<p><a href="${SITE}/advertiser/dashboard" style="color:#0f1f3d;font-weight:600;">Advertiser dashboard</a></p>`
    )
  );
}

/** Seven days before the next subscription charge (Edge Function / cron). */
export async function subscription_renewal_reminder(
  advertiserName: string,
  email: string,
  adTitle: string,
  nextChargeGbp: string,
  nextBillingDate: string,
  cancelUrl: string,
  upgradeUrl: string
): Promise<void> {
  const name = escapeHtml(advertiserName);
  await sendResend(
    email,
    'Your Ground View News ad subscription renews in 7 days',
    wrapBody(
      `<p>Hello ${name},</p>
<p>Your plan for <strong>${escapeHtml(adTitle)}</strong> will renew on <strong>${escapeHtml(nextBillingDate)}</strong> (UTC).</p>
<p><strong>Next charge:</strong> ${escapeHtml(nextChargeGbp)}</p>
<p><a href="${escapeHtml(cancelUrl)}" style="display:inline-block;background:#64748b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Manage cancellation</a>
&nbsp;
<a href="${escapeHtml(upgradeUrl)}" style="display:inline-block;background:#0f1f3d;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Upgrade options</a></p>`
    )
  );
}
