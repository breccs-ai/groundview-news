'use client';

import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import type { ArticleBody, ArticleImage } from '@/lib/supabase';
import { storedBodyToEditorMarkdown } from '@/lib/article-markdown';
import AdSlot from '@/components/ads/AdSlot';

type Props = {
  body: ArticleBody;
  /** Insert in-article ad slot after the third paragraph when true. */
  injectMidAd?: boolean;
  /** Images to insert through the body. The hero image is rendered by the page. */
  inlineImages?: ArticleImage[];
};

const GEORGIA = { fontFamily: "Georgia, 'Times New Roman', serif" };
const PLAYFAIR = { fontFamily: "'Playfair Display', Georgia, serif" };

function buildMarkdownComponents(
  getParagraphIndex: () => number,
  injectMidAd?: boolean,
  imagePlacements: Array<{ afterParagraph: number; image: ArticleImage }> = []
): Components {
  return {
    h1: ({ children, ...props }) => (
      <h1
        {...props}
        style={{
          ...PLAYFAIR,
          fontSize: '32px',
          fontWeight: 700,
          color: '#0a0a0a',
          marginTop: '2.5rem',
          marginBottom: '1rem',
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2
        {...props}
        style={{
          ...PLAYFAIR,
          fontSize: '26px',
          fontWeight: 700,
          color: '#0a0a0a',
          borderBottom: '2px solid #D4AF37',
          paddingBottom: '0.5rem',
          marginTop: '2.5rem',
          marginBottom: '1rem',
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        {...props}
        style={{
          ...PLAYFAIR,
          fontSize: '21px',
          fontWeight: 600,
          color: '#0a0a0a',
          marginTop: '2rem',
          marginBottom: '0.75rem',
        }}
      >
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4
        {...props}
        style={{
          ...PLAYFAIR,
          fontSize: '18px',
          fontWeight: 600,
          color: '#0a0a0a',
          marginTop: '1.5rem',
          marginBottom: '0.5rem',
        }}
      >
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => {
      const idx = getParagraphIndex();
      const isFirst = idx === 0;
      const paragraph = (
        <p
          {...props}
          className={isFirst ? 'markdown-first-p' : undefined}
          style={{
            ...GEORGIA,
            fontSize: '18px',
            lineHeight: 1.8,
            color: '#1a1a1a',
            marginBottom: '1.5rem',
          }}
        >
          {children}
        </p>
      );
      const imagesAfterParagraph = imagePlacements.filter(
        (placement) => placement.afterParagraph === idx + 1
      );
      const showAd = injectMidAd && idx === 2;

      if (showAd || imagesAfterParagraph.length > 0) {
        return (
          <>
            {paragraph}
            {showAd && (
              <div className="my-10">
                <AdSlot zone="article_in_content" variant="inline" />
              </div>
            )}
            {imagesAfterParagraph.map((placement) => (
              <figure key={placement.image.url} className="my-10">
                <img
                  src={placement.image.url}
                  alt=""
                  className="mx-auto block h-auto max-h-[640px] w-auto max-w-full rounded-sm"
                  loading="lazy"
                />
                <figcaption className="mt-2 min-h-[1.25rem] text-center text-sm italic text-gray-500">
                  {placement.image.caption}
                </figcaption>
              </figure>
            ))}
          </>
        );
      }
      return paragraph;
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        {...props}
        style={{
          borderLeft: '4px solid #D4AF37',
          paddingLeft: '1.5rem',
          fontStyle: 'italic',
          fontSize: '20px',
          color: '#444',
          margin: '2rem 0',
          ...GEORGIA,
        }}
      >
        {children}
      </blockquote>
    ),
    ul: ({ children, ...props }) => (
      <ul
        {...props}
        style={{
          listStyle: 'disc',
          paddingLeft: '1.5rem',
          marginBottom: '1.5rem',
          fontSize: '18px',
          lineHeight: 1.8,
          ...GEORGIA,
          color: '#1a1a1a',
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        {...props}
        style={{
          listStyle: 'decimal',
          paddingLeft: '1.5rem',
          marginBottom: '1.5rem',
          fontSize: '18px',
          lineHeight: 1.8,
          ...GEORGIA,
          color: '#1a1a1a',
        }}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li {...props} style={{ marginBottom: '0.5rem' }}>
        {children}
      </li>
    ),
    strong: ({ children, ...props }) => (
      <strong {...props} style={{ fontWeight: 700, color: '#0a0a0a' }}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em {...props} style={{ fontStyle: 'italic' }}>
        {children}
      </em>
    ),
    a: ({ children, href, ...props }) => {
      const external = typeof href === 'string' && /^https?:\/\//i.test(href);
      return (
        <a
          {...props}
          href={href ?? '#'}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          style={{ color: '#D4AF37' }}
          className="underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    },
    hr: (props) => (
      <hr
        {...props}
        style={{ borderTop: '1px solid #D4AF37', margin: '2rem 0', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }}
      />
    ),
    img: (props) => {
      const { alt, src } = props as { alt?: string; src?: string };
      return (
        <img
          src={src ?? ''}
          alt={alt ?? ''}
          style={{ maxWidth: '100%', borderRadius: 8, margin: '2rem 0', height: 'auto' }}
          loading="lazy"
        />
      );
    },
    code: (props) => {
      const { inline, children, ...rest } = props as {
        inline?: boolean;
        children?: ReactNode;
        className?: string;
      };
      if (inline) {
        return (
          <code
            {...rest}
            style={{
              background: '#f4f4f4',
              padding: '2px 6px',
              borderRadius: 4,
              fontFamily: 'ui-monospace, monospace',
              fontSize: '14px',
            }}
          >
            {children}
          </code>
        );
      }
      return (
        <code
          {...rest}
          style={{
            display: 'block',
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '14px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        {...props}
        style={{
          background: '#1a1a1a',
          color: '#f4f4f4',
          padding: '1.5rem',
          borderRadius: 8,
          overflowX: 'auto',
          margin: '2rem 0',
        }}
      >
        {children}
      </pre>
    ),
    table: ({ children, ...props }) => (
      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table {...props} style={{ width: '100%', borderCollapse: 'collapse', ...GEORGIA }}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        {...props}
        style={{ borderBottom: '1px solid #ccc', padding: '0.5rem', textAlign: 'left', fontWeight: 600 }}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td {...props} style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>
        {children}
      </td>
    ),
  };
}

type MarkdownInnerProps = {
  markdown: string;
  wrapperClassName?: string;
  injectMidAd?: boolean;
  inlineImages?: ArticleImage[];
};

function countMarkdownParagraphs(markdown: string): number {
  let inFence = false;
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => {
      if (block.startsWith('```') || block.startsWith('~~~')) {
        inFence = !inFence;
        return false;
      }
      if (inFence || !block) return false;
      return !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|---+$|!\[|<)/.test(block);
    }).length;
}

function buildImagePlacements(markdown: string, inlineImages: ArticleImage[]) {
  const images = inlineImages.filter((image) => image.url).slice(0, 2);
  if (images.length === 0) return [];

  const paragraphCount = Math.max(1, countMarkdownParagraphs(markdown));
  if (images.length === 1) {
    return [{ afterParagraph: Math.ceil(paragraphCount / 2), image: images[0] }];
  }

  return [
    { afterParagraph: Math.ceil(paragraphCount / 3), image: images[0] },
    { afterParagraph: Math.ceil((paragraphCount * 2) / 3), image: images[1] },
  ];
}

export function MarkdownBodyContent({
  markdown,
  wrapperClassName,
  injectMidAd,
  inlineImages = [],
}: MarkdownInnerProps) {
  const paragraphIndexRef = useRef(0);
  paragraphIndexRef.current = 0;
  const imagePlacements = useMemo(
    () => buildImagePlacements(markdown, inlineImages),
    [markdown, inlineImages]
  );

  const components = useMemo(
    () =>
      buildMarkdownComponents(() => {
        const idx = paragraphIndexRef.current;
        paragraphIndexRef.current += 1;
        return idx;
      }, injectMidAd, imagePlacements),
    [injectMidAd, imagePlacements],
  );

  return (
    <div className={`article-markdown-body w-full max-w-full ${wrapperClassName || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default function ArticleBodyRenderer({ body, injectMidAd, inlineImages = [] }: Props) {
  const markdown = storedBodyToEditorMarkdown(body as unknown).trim();

  if (!markdown) {
    return <p className="text-gray-400 italic w-full max-w-full">No content available.</p>;
  }

  return (
    <MarkdownBodyContent
      markdown={markdown}
      injectMidAd={injectMidAd}
      inlineImages={inlineImages}
    />
  );
}
