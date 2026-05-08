import { ArticleBody, ArticleBodyBlock } from '@/lib/supabase';

type Props = {
  body: ArticleBody;
};

export default function ArticleBodyRenderer({ body }: Props) {
  if (!body) {
    return <p className="text-gray-400 italic">No content available.</p>;
  }

  // If body is a string, render as plain text paragraphs
  if (typeof body === 'string') {
    return (
      <div className="article-body mx-auto max-w-[720px]">
        {body.split('\n\n').map((para, i) => (
          <p
            key={i}
            className="text-[16px] md:text-[18px] leading-[1.8] text-[#1a1a1a] mb-6"
            style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
          >
            {para}
          </p>
        ))}
      </div>
    );
  }

  // If body has a content array, render blocks
  if (body.content && Array.isArray(body.content)) {
    return (
      <div className="article-body mx-auto max-w-[720px]">
        {body.content.map((block: ArticleBodyBlock, i: number) => {
          if (block.type === 'paragraph') {
            return (
              <p
                key={i}
                className="text-[16px] md:text-[18px] leading-[1.8] text-[#1a1a1a] mb-6"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                dangerouslySetInnerHTML={{ __html: sanitize(block.text) }}
              />
            );
          }
          if (block.type === 'heading') {
            const level = block.level || 2;
            if (level === 3) {
              return (
                <h3
                  key={i}
                  className="text-[21px] font-semibold mt-8 mb-3 text-[#0a0a0a] leading-snug"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {block.text}
                </h3>
              );
            }
            return (
              <h2
                key={i}
                className="text-[26px] font-bold mt-10 mb-4 text-[#0a0a0a] leading-snug border-b-2 pb-2"
                style={{ fontFamily: 'Playfair Display, Georgia, serif', borderBottomColor: '#D4AF37' }}
              >
                {block.text}
              </h2>
            );
          }
          if ((block as any).type === 'quote') {
            const q = (block as any).text as string | undefined;
            if (!q) return null;
            return (
              <blockquote
                key={i}
                className="my-8 pl-6 italic text-[20px] text-[#444]"
                style={{ borderLeft: '4px solid #D4AF37' }}
              >
                {q}
              </blockquote>
            );
          }
          if ((block as any).type === 'divider') {
            return (
              <div
                key={i}
                className="my-8 text-center text-[24px]"
                style={{ color: '#D4AF37' }}
              >
                • • •
              </div>
            );
          }
          if ((block as any).type === 'list') {
            const ordered = Boolean((block as any).ordered);
            const items = Array.isArray((block as any).items) ? ((block as any).items as string[]) : [];
            if (items.length === 0) return null;

            if (ordered) {
              return (
                <ol
                  key={i}
                  className="mb-6 pl-6 list-decimal"
                  style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
                >
                  {items.map((it, idx) => (
                    <li key={idx} className="text-[18px] leading-[1.8] text-[#1a1a1a]">
                      {it}
                    </li>
                  ))}
                </ol>
              );
            }

            return (
              <ul
                key={i}
                className="mb-6 space-y-2"
                style={{ fontFamily: 'Georgia, Times New Roman, serif' }}
              >
                {items.map((it, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-[18px] leading-[1.8] text-[#1a1a1a]">
                    <span
                      className="mt-[0.55rem] h-2 w-2 rounded-[2px] flex-shrink-0"
                      style={{ backgroundColor: '#D4AF37' }}
                      aria-hidden="true"
                    />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            );
          }
          if (block.type === 'image') {
            return (
              <figure key={i} className="my-8">
                <img
                  src={block.url}
                  alt={block.caption || ''}
                  className="w-full"
                  style={{ borderRadius: 8 }}
                />
                {block.caption && (
                  <figcaption className="mt-2 text-center italic text-[14px]" style={{ color: '#666' }}>
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // Fallback: render JSON as string
  return (
    <div className="article-body">
      <p>{JSON.stringify(body)}</p>
    </div>
  );
}

function sanitize(text: string): string {
  // Basic sanitisation: allow only safe inline elements
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
