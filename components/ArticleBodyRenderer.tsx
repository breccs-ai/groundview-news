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
      <div className="article-body">
        {body.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    );
  }

  // If body has a content array, render blocks
  if (body.content && Array.isArray(body.content)) {
    return (
      <div className="article-body">
        {body.content.map((block: ArticleBodyBlock, i: number) => {
          if (block.type === 'paragraph') {
            return <p key={i} dangerouslySetInnerHTML={{ __html: sanitize(block.text) }} />;
          }
          if (block.type === 'heading') {
            const level = block.level || 2;
            if (level === 3) {
              return (
                <h3 key={i}>{block.text}</h3>
              );
            }
            return <h2 key={i}>{block.text}</h2>;
          }
          if (block.type === 'image') {
            return (
              <figure key={i} className="my-8">
                <img
                  src={block.url}
                  alt={block.caption || ''}
                  className="w-full rounded-sm"
                />
                {block.caption && (
                  <figcaption className="mt-2 text-center text-xs text-gray-400 italic">
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
  // Basic sanitisation — allow only safe inline elements
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
