/**
 * Emits a JSON-LD <script> for structured data. Server Component — the markup
 * is in the initial HTML so crawlers see it. `data` is trusted (built by our
 * own schema helpers), so dangerouslySetInnerHTML is safe here.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
