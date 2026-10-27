import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes, SavedStyle } from '../app/App';
import { DatabaseProvider } from '../db/DatabaseProvider';
import type { HabitDb } from '../db/db';
import { ensureDefaults } from '../db/defaults';
import { updateSettings, type SettingsPatch } from '../db/settings-repo';
import { openTestDb } from './db';

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

// Renders the app's routes at `route` over a fresh database with the default content,
// plus any `settings` given.
export async function renderRoute(
  route: string,
  settings?: SettingsPatch,
): Promise<{
  db: HabitDb;
  user: ReturnType<typeof userEvent.setup>;
}> {
  const db = await openTestDb();
  await ensureDefaults(db);
  if (settings) await updateSettings(db, settings);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[route]}>
      <DatabaseProvider open={() => Promise.resolve(db)}>
        <SavedStyle />
        <AppRoutes />
        <CurrentPath />
      </DatabaseProvider>
    </MemoryRouter>,
  );
  return { db, user };
}
