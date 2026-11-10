import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'
import { CLERK_PUBLISHABLE_KEY, isClerkEnabled } from './lib/clerk'

const tree = isClerkEnabled ? (
  <ClerkProvider
    publishableKey={CLERK_PUBLISHABLE_KEY}
    signInUrl="/login"
    signUpUrl="/signup"
    signInFallbackRedirectUrl="/"
    signUpFallbackRedirectUrl="/"
    afterSignOutUrl="/"
  >
    <App />
  </ClerkProvider>
) : (
  <App />
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {tree}
  </StrictMode>
)
