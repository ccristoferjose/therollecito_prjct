import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from '@shared/context/CartContext';
import { LangProvider } from '@shared/context/LangContext';
import { ClientAuthProvider } from '@shared/context/ClientAuthContext';
import { StaffAuthProvider } from '@shared/context/StaffAuthContext';

// Client pages
import ClientLayout from '@client/layouts/ClientLayout';
import LandingPage from '@client/pages/LandingPage';
import LocationsPage from '@client/pages/LocationsPage';
import OrderPage from '@client/pages/OrderPage';
import CartPage from '@client/pages/CartPage';
import CheckoutPage from '@client/pages/CheckoutPage';
import OrderConfirmationPage from '@client/pages/OrderConfirmationPage';
import OrderTrackingPage from '@client/pages/OrderTrackingPage';
import ProfilePage from '@client/pages/ProfilePage';

// Staff pages
import StaffLoginPage from '@staff/pages/StaffLoginPage';
import StaffLayout from '@staff/layouts/StaffLayout';
import StaffRoute from '@staff/components/StaffRoute';
import AdminDashboard from '@staff/pages/AdminDashboard';
import KitchenDashboard from '@staff/pages/KitchenDashboard';
import MenuManagement from '@staff/pages/MenuManagement';
import LocationManagement from '@staff/pages/LocationManagement';
import UserManagement from '@staff/pages/UserManagement';
import PromotionManagement from '@staff/pages/PromotionManagement';
import KitchenHistory from '@staff/pages/KitchenHistory';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ==============================================================
            CLIENT ROUTES — public, wrapped in CartProvider
            ============================================================== */}
        <Route
          element={
            <LangProvider>
              <ClientAuthProvider>
                <CartProvider>
                  <ClientLayout />
                </CartProvider>
              </ClientAuthProvider>
            </LangProvider>
          }
        >
          <Route index element={<LandingPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="order" element={<OrderPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          <Route path="track" element={<OrderTrackingPage />} />
          <Route path="track/:trackingCode" element={<OrderTrackingPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* ==============================================================
            STAFF ROUTES — completely isolated, wrapped in StaffAuthProvider
            ============================================================== */}
        <Route
          path="staff"
          element={
            <StaffAuthProvider>
              <StaffLoginPage />
            </StaffAuthProvider>
          }
        />
        <Route path="staff/login" element={<StaffAuthProvider><StaffLoginPage /></StaffAuthProvider>} />

        {/* Admin */}
        <Route
          path="staff/admin"
          element={
            <StaffAuthProvider>
              <StaffRoute allowedRoles={['admin']}>
                <StaffLayout />
              </StaffRoute>
            </StaffAuthProvider>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="menu" element={<MenuManagement />} />
          <Route path="locations" element={<LocationManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="promotions" element={<PromotionManagement />} />
        </Route>

        {/* Kitchen */}
        <Route
          path="staff/kitchen"
          element={
            <StaffAuthProvider>
              <StaffRoute allowedRoles={['admin', 'manager']}>
                <StaffLayout />
              </StaffRoute>
            </StaffAuthProvider>
          }
        >
          <Route index element={<KitchenDashboard />} />
          <Route path="history" element={<KitchenHistory />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
