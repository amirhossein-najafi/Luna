import { Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell.tsx'
import { AccountsPage } from './pages/Accounts.tsx'
import { AssetsPage } from './pages/Assets.tsx'
import { BudgetsPage } from './pages/Budgets.tsx'
import { DashboardPage } from './pages/Dashboard.tsx'
import { GoalsPage } from './pages/Goals.tsx'
import { InboxPage } from './pages/Inbox.tsx'
import { PlansPage } from './pages/Plans.tsx'
import { ReportsPage } from './pages/Reports.tsx'
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
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FinanceProvider>
  )
}
