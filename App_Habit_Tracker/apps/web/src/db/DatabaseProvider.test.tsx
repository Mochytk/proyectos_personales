import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '../test/db';
import { DatabaseProvider, useDb } from './DatabaseProvider';

function DbName() {
  return <p>{useDb().name}</p>;
}

describe('DatabaseProvider', () => {
  it('adds the default content before rendering the screens', async () => {
    const db = await openTestDb();
    render(
      <DatabaseProvider open={() => Promise.resolve(db)}>
        <DbName />
      </DatabaseProvider>,
    );

    expect(await screen.findByText(db.name)).toBeTruthy();
    expect(await db.anchors.count()).toBe(7);
    expect(await db.userSettings.count()).toBe(1);
  });

  it('offers a retry when opening fails for another reason', async () => {
    render(
      <DatabaseProvider open={() => Promise.reject(new Error('boom'))}>
        <DbName />
      </DatabaseProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos cargar esto.');
  });
});
