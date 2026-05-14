import Link from 'next/link';
import { Pencil } from 'lucide-react';

type Props = {
  articleId: string;
};

/** Floating edit control for admins on public article pages (visibility gated by server cookie). */
export default function AdminArticleEditFab({ articleId }: Props) {
  return (
    <Link
      href={`/admin/articles/edit/${articleId}`}
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#d4af37] text-[#1a1a1a] shadow-lg shadow-black/20 transition-colors hover:bg-[#c9a227] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37]"
      aria-label="Edit article in admin"
      title="Edit article"
    >
      <Pencil size={20} strokeWidth={2.25} />
    </Link>
  );
}
