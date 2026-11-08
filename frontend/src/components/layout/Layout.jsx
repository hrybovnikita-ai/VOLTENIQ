import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout() {
  const { pathname } = useLocation()
  const isAssistant = pathname === '/assistant' || pathname.startsWith('/assistant/')

  return (
    <div
      className={`page-bg flex flex-col text-ink dark:text-snow overflow-x-clip ${
        isAssistant ? 'ai-layout' : 'min-h-dvh'
      }`}
    >
      <Navbar />
      <main
        className={`flex-1 w-full min-w-0 ${
          isAssistant ? 'flex flex-col min-h-0 overflow-hidden' : ''
        }`}
      >
        <Outlet />
      </main>
      {isAssistant ? null : <Footer />}
    </div>
  )
}
