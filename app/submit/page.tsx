import { redirect } from 'next/navigation';

// This page used to let anyone create draft articles directly in the live
// articles table with the public database key. Writers now apply and submit
// through the writer programme, so send visitors there.
export default function SubmitPage() {
  redirect('/write-for-us');
}
