import type { Metadata } from 'next';

// Page title (WCAG 2.4.2). page.tsx is a Client Component and cannot export
// metadata, so it lives on this pass-through layout.
export const metadata: Metadata = {
  title: 'Your cart',
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
