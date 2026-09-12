import { LangProvider } from '@/providers/lang-provider';
import { ClientAuthProvider } from '@/providers/client-auth-provider';
import { CartProvider } from '@/providers/cart-provider';
<<<<<<< HEAD
import { PickupProvider } from '@/providers/pickup-provider';
=======
>>>>>>> origin/feature/main-dashboard
import ClientChrome from '@/components/layout/client-chrome';

/**
 * CLIENT portal layout — the ordering experience (order, cart, checkout,
 * tracking, profile). Client providers are mounted HERE at the route-group
 * level rather than globally, so the marketing + staff surfaces don't pay for
 * cart/auth context they don't use.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <ClientAuthProvider>
        <CartProvider>
<<<<<<< HEAD
          {/* Inside CartProvider: pickup revalidation reads the cart's items
              and location to check them against the selected pickup time. */}
          <PickupProvider>
            <ClientChrome>{children}</ClientChrome>
          </PickupProvider>
=======
          <ClientChrome>{children}</ClientChrome>
>>>>>>> origin/feature/main-dashboard
        </CartProvider>
      </ClientAuthProvider>
    </LangProvider>
  );
}
