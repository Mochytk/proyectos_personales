import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DatabaseProvider } from '../db/DatabaseProvider';
import { settingsId } from '../db/defaults';
import { writeRows } from '../db/write';
import { openTestDb } from '../test/db';
import { useSettings } from './useSettings';

describe('useSettings', () => {
  it('reads the saved settings and follows changes', async () => {
    const db = await openTestDb();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatabaseProvider open={() => Promise.resolve(db)}>{children}</DatabaseProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current).toMatchObject({ style: 'cuaderno', dayCutoffHour: 4 });
    });

    const saved = await db.userSettings.get(await settingsId());
    if (!saved) throw new Error('missing settings');
    await writeRows(db, 'userSettings', [{ ...saved, style: 'disco' }]);
    await waitFor(() => {
      expect(result.current.style).toBe('disco');
    });
  });
});
