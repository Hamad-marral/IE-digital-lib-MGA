import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import { useAuth } from './lib/auth'
import Dashboard from './pages/Dashboard'
import FolderDetail from './pages/FolderDetail'
import Inventory from './pages/Inventory'
import IssueReturn from './pages/IssueReturn'
import Library from './pages/Library'
import Login from './pages/Login'
import QrLabels from './pages/QrLabels'
import Reports from './pages/Reports'
import Scan from './pages/Scan'
import SettingsPage from './pages/Settings'
import Transactions from './pages/Transactions'
import UsersPage from './pages/Users'

export default function App() {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Spinner />
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/scan/:code" element={<Scan />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname + location.search }} />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to={location.state?.from || '/'} replace />} />
      <Route path="/scan/:code" element={<Scan />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:id" element={<FolderDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="issue-return" element={<IssueReturn />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="reports" element={<Reports />} />
        <Route path="qr-labels" element={<QrLabels />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
