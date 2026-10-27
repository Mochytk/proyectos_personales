import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from '../app/App';
import { DatabaseProvider } from '../db/DatabaseProvider';
import type { HabitDb } from '../db/db';
import { ensureDefaults } from '../db/defaults';
import { openTestDb } from './db';

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

// Renders the app's routes at `route` over a fresh database with the default content.
export async function renderRoute(route: string): Promise<{
  db: HabitDb;
  user: ReturnType<typeof userEvent.setup>;
}> {
  const db = await openTestDb();
  await ensureDefaults(db);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[route]}>
      <DatabaseProvider open={() => Promise.resolve(db)}>
        <AppRoutes />
        <CurrentPath />
      </DatabaseProvider>
    </MemoryRouter>,
  );
  return { db, user };
}
