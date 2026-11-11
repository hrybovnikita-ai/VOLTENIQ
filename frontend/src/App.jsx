import CookieNotice from './components/CookieNotice'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { CompareProvider } from './context/CompareContext'
import RequireAuth from './components/auth/RequireAuth'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import CatalogPage from './pages/CatalogPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CartPage from './pages/CartPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import CheckoutPage from './pages/CheckoutPage'
import SharedWishlist from './pages/SharedWishlist'
import FavoritesPage from './pages/FavoritesPage'
import ComparePage from './pages/ComparePage'
import { lazy, Suspense } from 'react'
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import SsoCallbackPage from './pages/SsoCallbackPage'
import { isClerkEnabled } from './lib/clerk'
import { firebaseConfigured } from './lib/firebase'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AssistantPage from './pages/AssistantPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <FavoritesProvider>
            <CompareProvider>
              <BrowserRouter>
                <Routes>
                  {['forgot-password', 'reset-password'].map(path => <Route key={path} path={path} element={<Suspense fallback={<p role="status">Loading…</p>}><RecoveryPage /></Suspense>} />)}
                  <Route path="verify-email" element={<Suspense fallback={<p role="status">Loading…</p>}><VerifyEmailPage /></Suspense>} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="signup" element={<SignupPage />} />
                  {isClerkEnabled && !firebaseConfigured ? <Route path="sso-callback" element={<SsoCallbackPage />} /> : null}
                  <Route element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="catalog" element={<CatalogPage />} />
                    <Route path="products/:id" element={<ProductDetailPage />} />
                    <Route path="order/success" element={<RequireAuth><OrderSuccessPage /></RequireAuth>} />
                    <Route path="cart" element={<RequireAuth><CartPage /></RequireAuth>} />
                    <Route
                      path="checkout"
                      element={
                        <RequireAuth>
                          <CheckoutPage />
                        </RequireAuth>
                      }
                    />
                    <Route path="wishlist" element={<SharedWishlist />} />
                    <Route path="favorites" element={<FavoritesPage />} />
                    <Route path="compare" element={<ComparePage />} />
                    <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
                    <Route path="admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
                    <Route path="assistant" element={<AssistantPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
                <CookieNotice />
              </BrowserRouter>
            </CompareProvider>
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
