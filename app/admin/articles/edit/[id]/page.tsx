import AdminShell from '@/components/AdminShell';
import ArticleEditorForm from '@/components/ArticleEditorForm';

type Props = {
  params: { id: string };
};

export default function EditArticlePage({ params }: Props) {
  return (
    <AdminShell>
      <ArticleEditorForm articleId={params.id} />
    </AdminShell>
  );
}
