import AdminShell from '@/components/AdminShell';
import ArticleEditorForm from '@/components/ArticleEditorForm';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditArticlePage({ params }: Props) {
  const { id } = await params;
  return (
    <AdminShell>
      <ArticleEditorForm articleId={id} />
    </AdminShell>
  );
}
