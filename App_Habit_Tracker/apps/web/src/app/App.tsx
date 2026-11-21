import { NavLink, Route, Routes } from 'react-router';
import { AccountScreen } from '../account/AccountScreen';
import { ResetPasswordScreen } from '../account/ResetPasswordScreen';
import { DatabaseProvider, useDb } from '../db/DatabaseProvider';
import { HabitDetailScreen } from '../habits/HabitDetailScreen';
import { HabitEditScreen } from '../habits/HabitEditScreen';
import { HabitsScreen } from '../habits/HabitsScreen';
import { ReviewScreen } from '../review/ReviewScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { TodayScreen } from '../today/TodayScreen';
import { useSettings } from '../settings/useSettings';
import { SyncStatus } from '../sync/SyncStatus';
import { useSync } from '../sync/useSync';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useStyle } from './useStyle';
import { useToday } from './useToday';

const TABS = [
  { to: '/', label: 'Hoy', icon: 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4' },
  { to: '/habitos', label: 'Hábitos', icon: 'M5 6h14M5 12h14M5 18h9' },
  { to: '/revision', label: 'Revisión', icon: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3' },
  {
    to: '/ajustes',
    label: 'Ajustes',
    icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  },
] as const;

// Applies the saved style; with "rotar" it changes on Mondays at the cutoff (ADR 0009).
export function SavedStyle() {
  useStyle(useSettings().style, useToday());
  return null;
}

// Keeps this device in sync while the app is open, and says how it is going.
export function SyncBar() {
  const { result, pending } = useSync(useDb());
  return <SyncStatus result={result} pending={pending} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<TodayScreen />} />
      <Route path="habitos" element={<HabitsScreen />} />
      <Route path="habitos/nuevo" element={<HabitEditScreen />} />
      <Route path="habitos/:id" element={<HabitDetailScreen />} />
      <Route path="habitos/:id/editar" element={<HabitEditScreen />} />
      <Route path="revision" element={<ReviewScreen />} />
      <Route path="ajustes" element={<SettingsScreen />} />
      <Route path="cuenta" element={<AccountScreen />} />
      <Route path="restablecer" element={<ResetPasswordScreen />} />
    </Routes>
  );
}

export function App() {
  return (
    <div className="app">
      <main className="app-main">
        <ErrorBoundary>
          <DatabaseProvider>
            <SavedStyle />
            <SyncBar />
            <AppRoutes />
          </DatabaseProvider>
        </ErrorBoundary>
      </main>
      <nav className="tab-bar" aria-label="Secciones">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
