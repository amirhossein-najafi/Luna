import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { AssetsPage } from './pages/Assets.tsx'
import { BudgetsPage } from './pages/Budgets.tsx'
import { DashboardPage } from './pages/Dashboard.tsx'
import { SettingsPage } from './pages/Settings.tsx'
import { TransactionsPage } from './pages/Transactions.tsx'
import { FinanceProvider } from './store/finance.tsx'

export default function App() {
  return (
    <FinanceProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FinanceProvider>
  )
}
