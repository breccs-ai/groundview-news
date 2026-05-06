import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function moderateText(text: string): Promise<{ flagged: boolean; reason?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { flagged: false };

  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) return { flagged: false };

  const data = await res.json();
  const result = data.results?.[0];
  if (!result?.flagged) return { flagged: false };

  const categories = result.categories as Record<string, boolean>;
  const flaggedCats = Object.entries(categories)
    .filter(([, v]) => v)
    .map(([k]) => k.replace('/', ' / '));

  return { flagged: true, reason: `Content flagged for: ${flaggedCats.join(', ')}.` };
}

async function moderateImage(imageUrl: string): Promise<{ flagged: boolean; reason?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !imageUrl) return { flagged: false };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Review this image for an advertisement. Does it contain hate speech, violence, sexual content, harassment, terrorism, or illegal activity? Reply with JSON: {"flagged": true/false, "reason": "short reason if flagged"}',
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 100,
    }),
  });

  if (!res.ok) return { flagged: false };

  try {
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    return { flagged: !!parsed.flagged, reason: parsed.reason };
  } catch {
    return { flagged: false };
  }
}

export async function POST(req: NextRequest) {
  const { adId, title, copy, destination_url, image_url } = await req.json();

  if (!adId) {
    return NextResponse.json({ error: 'Missing adId' }, { status: 400 });
  }

  const textToCheck = [title, copy, destination_url].filter(Boolean).join('\n');
  const textResult = await moderateText(textToCheck);

  if (textResult.flagged) {
    const supabase = getSupabase();
    await supabase.from('advertisements')
      .update({ status: 'rejected', rejection_reason: textResult.reason, updated_at: new Date().toISOString() })
      .eq('id', adId);

    const { data: ad } = await supabase.from('advertisements').select('user_id').eq('id', adId).maybeSingle();
    if (ad?.user_id) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', ad.user_id).maybeSingle();
      if (profile?.email) {
        await sendEmail(
          profile.email,
          'Your Ground View News ad was not approved',
          `<p>Your recent ad submission was reviewed by our automated content moderation system and was not approved.</p>
<p><strong>Reason:</strong> ${textResult.reason}</p>
<p>If you believe this is an error, please contact <a href="mailto:support@groundviewnews.com">support@groundviewnews.com</a>.</p>`
        );
      }
    }

    return NextResponse.json({ passed: false, reason: textResult.reason });
  }

  if (image_url) {
    const imageResult = await moderateImage(image_url);
    if (imageResult.flagged) {
      const supabase = getSupabase();
      await supabase.from('advertisements')
        .update({ status: 'rejected', rejection_reason: imageResult.reason, image_url: null, updated_at: new Date().toISOString() })
        .eq('id', adId);

      const { data: ad } = await supabase.from('advertisements').select('user_id').eq('id', adId).maybeSingle();
      if (ad?.user_id) {
        const { data: profile } = await supabase.from('profiles').select('email').eq('id', ad.user_id).maybeSingle();
        if (profile?.email) {
          await sendEmail(
            profile.email,
            'Your Ground View News ad image was not approved',
            `<p>Your ad image did not pass content moderation and has not been saved.</p>
<p><strong>Reason:</strong> ${imageResult.reason}</p>
<p>Please upload a different image or contact <a href="mailto:support@groundviewnews.com">support@groundviewnews.com</a> if you believe this is an error.</p>`
          );
        }
      }

      return NextResponse.json({ passed: false, reason: imageResult.reason });
    }
  }

  const supabase = getSupabase();
  await supabase.from('advertisements')
    .update({ status: 'pending_review', updated_at: new Date().toISOString() })
    .eq('id', adId);

  return NextResponse.json({ passed: true });
}
