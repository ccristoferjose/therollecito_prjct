import type { MetadataRoute } from 'next';
import { env } from '@/lib/config/env';

// Public, indexable routes only. Per-location pages can be appended here once
// locations are fetched server-side (ISR).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${env.siteUrl}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.siteUrl}/locations`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${env.siteUrl}/order`, changeFrequency: 'daily', priority: 0.9 },
  ];
}
