import { redirect } from 'next/navigation';

export default function AdvertiseSuccessRedirectPage() {
  redirect('/advertiser/dashboard');
}
