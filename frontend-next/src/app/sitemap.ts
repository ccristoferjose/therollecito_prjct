import type { MetadataRoute } from 'next';
import { env } from '@/lib/config/env';
import { legal } from '@/lib/config/legal';

// Public, indexable routes only. Per-location pages can be appended here once
// locations are fetched server-side (ISR).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${env.siteUrl}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.siteUrl}/locations`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${env.siteUrl}/order`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${env.siteUrl}/accessibility`, changeFrequency: 'yearly', priority: 0.2 },
    // /privacy is added once legal.privacyPolicyPublished is true.
    ...(legal.privacyPolicyPublished
      ? [{ url: `${env.siteUrl}/privacy`, changeFrequency: 'yearly' as const, priority: 0.2 }]
      : []),
  ];
}
