import Link from 'next/link';

export default function AffiliateDisclosureNotice() {
  return (
    <p className="text-xs text-gray-400 mb-4">
      This article contains affiliate links.{' '}
      <Link href="/disclosure" className="underline hover:text-amber-700 transition-colors">
        Read our disclosure policy
      </Link>
      .
    </p>
  );
}
