import { escapeHtml, siteUrl } from '@/lib/email-branding';
import { renderDiffHtml, type ArticleDiff } from '@/lib/article-diff';

/**
 * Staff email sent when a writer resubmits an article after editor feedback:
 * your original comments, what changed (including how many links were added),
 * and a before/after of the text, so the editor can decide without opening
 * two versions side by side.
 */
export function resubmissionNotificationHtml(args: {
  articleId: string;
  articleTitle: string;
  writerName: string;
  round: number;
  items: string[];
  note?: string | null;
  diff: ArticleDiff;
}): { subject: string; bodyHtml: string } {
  const { diff } = args;
  const s = diff.stats;
  const subject = `Revised article ready for review (round ${args.round}): ${args.articleTitle}`;

  const comments = args.items
    .map((t) => `<li style="margin-bottom:6px;">${escapeHtml(t)}</li>`)
    .join('');

  const row = (label: string, before: string | number, after: string | number) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#555;">${label}</td><td style="padding:4px 0;"><strong>${before}</strong> &rarr; <strong>${after}</strong></td></tr>`;

  const noChanges = !diff.hasChanges
    ? `<p style="background:#fef3c7;border:1px solid #fcd34d;padding:10px;border-radius:3px;"><strong>No changes were detected</strong> since you sent your comments. The writer resubmitted the same text.</p>`
    : '';

  const sourcesNote =
    s.linksAfter > s.linksBefore
      ? `${s.linksAfter - s.linksBefore} link${s.linksAfter - s.linksBefore === 1 ? '' : 's'} added`
      : 'no new links added';

  const bodyHtml = `
    <p><strong>${escapeHtml(args.writerName || 'A writer')}</strong> has revised <strong>${escapeHtml(args.articleTitle)}</strong> after your feedback (round ${args.round}).</p>
    <p style="margin-bottom:4px;"><strong>What you asked for:</strong></p>
    <ul style="padding-left:20px;margin-top:4px;">${comments}</ul>
    ${args.note?.trim() ? `<p><em>Your note: ${escapeHtml(args.note.trim())}</em></p>` : ''}
    <p style="margin-bottom:4px;"><strong>What changed:</strong> ${sourcesNote}.</p>
    <table style="font-size:14px;border-collapse:collapse;margin-bottom:12px;">
      ${row('Words', s.wordsBefore, s.wordsAfter)}
      ${row('Links', s.linksBefore, s.linksAfter)}
      <tr><td style="padding:4px 14px 4px 0;color:#555;">Paragraphs edited / added / removed</td><td style="padding:4px 0;"><strong>${s.paragraphsModified} / ${s.paragraphsAdded} / ${s.paragraphsRemoved}</strong></td></tr>
    </table>
    ${noChanges}
    ${renderDiffHtml(diff)}
    <p style="margin-top:20px;">
      <a href="${siteUrl()}/admin/dashboard" style="display:inline-block;background:#0f1f3d;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">Open the editorial queue</a>
    </p>
    <p style="font-size:13px;color:#555;">From there you can approve it (the writer then publishes it) or request further changes. You can also <a href="${siteUrl()}/admin/articles/edit/${escapeHtml(args.articleId)}" style="color:#555;">read the full article</a>.</p>
  `;

  return { subject, bodyHtml };
}
