import { redirect } from 'next/navigation';

// The interview start form now lives at the index (/).
export default function ResponsesPage() {
  redirect('/');
}
