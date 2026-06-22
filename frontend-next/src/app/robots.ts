import type { MetadataRoute } from 'next';
import { env } from '@/lib/config/env';

// Public pages are crawlable; private client + staff routes are disallowed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/staff/', '/cart', '/checkout', '/profile', '/order-confirmation/', '/track'],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
