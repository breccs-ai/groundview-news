import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function AdvertiseNewRedirectPage({ searchParams }: Props) {
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
  }
  const query = qs.toString();
  redirect(query ? `/advertiser/create-ad?${query}` : '/advertiser/create-ad');
}
