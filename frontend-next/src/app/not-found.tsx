import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-3xl font-extrabold text-text">Page not found</h1>
      <p className="mt-2 text-text-secondary">
        That page isn&apos;t on the menu. Let&apos;s get you back to the good stuff.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-accent px-6 py-3 font-semibold text-text-inverse shadow-warm transition-colors hover:bg-accent-hover"
      >
        Back home
      </Link>
    </main>
  );
}
