import { NextResponse } from 'next/server';

export const NEWSLETTER_BUTTON_STYLE =
  'background:#0f1f3d;color:#ffffff;border:0;padding:12px 24px;border-radius:4px;font-size:15px;font-family:Arial,Helvetica,sans-serif;font-weight:bold;cursor:pointer;';

// Minimal branded page for the newsletter confirm and unsubscribe links. These are
// opened straight from an email, so they do not depend on the site's layout or JS.
export function newsletterHtmlPage(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" /><title>Ground View News</title></head>
<body style="margin:0;padding:60px 24px;background:#f6f6f4;font-family:Georgia,'Playfair Display',serif;color:#1a1a1a;text-align:center;">
  <div style="max-width:480px;margin:0 auto;">
    <h2 style="margin:0 0 16px;">Ground View <span style="color:#d4a017;">News</span></h2>
    <p style="font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );
}
