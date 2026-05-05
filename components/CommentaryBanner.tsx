import Link from 'next/link';

export default function CommentaryBanner() {
  return (
    <div className="w-full bg-gray-100 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          Ground View News publishes independent commentary and opinion. Articles reflect the
          views of individual authors.{' '}
          <Link
            href="/disclaimer"
            className="text-gray-600 underline underline-offset-2 hover:text-amber-700 transition-colors whitespace-nowrap"
          >
            Read our editorial disclaimer
          </Link>
        </p>
      </div>
    </div>
  );
}
