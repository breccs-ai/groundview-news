import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="bg-white min-h-[60vh] flex items-center justify-center py-20">
        <div className="text-center max-w-lg mx-auto px-4">
          <p
            className="text-7xl font-bold mb-6 select-none"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: '#e8edf5' }}
            aria-hidden="true"
          >
            404
          </p>
          <h1
            className="text-2xl font-bold text-gray-900 mb-3"
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
          >
            Page not found
          </h1>
          <p className="text-gray-500 text-base mb-8">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-sm hover:bg-blue-900 transition-colors"
          >
            Return to homepage
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
