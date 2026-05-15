import { redirect } from 'next/navigation';

export default function AdvertiseLoginRedirectPage() {
  redirect('/advertiser/dashboard');
}
