import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { ToastProvider } from '../context/ToastContext.jsx'
import OfflineBanner from '../shared/components/OfflineBanner.jsx'

export default function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          {children}
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
