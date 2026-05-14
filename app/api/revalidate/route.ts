import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const { slug } = await req.json().catch(() => ({}));

  revalidatePath('/');
  revalidatePath('/category/africa-diaspora');
  revalidatePath('/category/world-politics');
  revalidatePath('/category/human-rights');
  revalidatePath('/category/economy');
  revalidatePath('/category/commentary');

  if (slug) {
    revalidatePath(`/article/${slug}`);
    revalidatePath(`/articles/${slug}`);
  }

  return NextResponse.json({ revalidated: true });
}
