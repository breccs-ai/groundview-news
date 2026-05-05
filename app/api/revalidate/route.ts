import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  const { slug } = await req.json().catch(() => ({}));

  revalidatePath('/');
  revalidatePath('/category/[category]', 'page');

  if (slug) {
    revalidatePath(`/article/${slug}`);
  }

  return NextResponse.json({ revalidated: true });
}
