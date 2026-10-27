import { parseLocalDate } from '@habit-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { habitsRepo } from '../db/habits-repo';
import { userEvent } from '@testing-library/user-event';
import { renderRoute } from '../test/render';

async function anchorList() {
  const section = await screen.findByRole('region', { name: 'Anclas' });
  await userEvent.click(within(section).getByRole('button', { name: 'Editar anclas' }));
  return within(section);
}

function listedNames(list: Awaited<ReturnType<typeof anchorList>>): string[] {
  const active = within(list.getByRole('list', { name: 'Anclas activas' }));
  return active.getAllByRole('listitem').map((item) => item.dataset.name ?? '');
}

describe('AnchorsEditor', () => {
  it('shows only the anchor names until editing starts', async () => {
    await renderRoute('/habitos');
    const section = within(await screen.findByRole('region', { name: 'Anclas' }));

    expect(await section.findByText(/^Al despertar · Mañana/)).toBeTruthy();
    expect(section.queryByRole('button', { name: 'Renombrar Tarde' })).toBeNull();
    expect(
      section.getByRole('button', { name: 'Editar anclas' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('adds an anchor', async () => {
    const { user } = await renderRoute('/habitos');
    const list = await anchorList();

    await user.type(await list.findByLabelText('Nueva ancla'), 'Al llegar a casa');
    await user.click(list.getByRole('button', { name: 'Agregar' }));

    await waitFor(() => {
      expect(listedNames(list).at(-1)).toBe('Al llegar a casa');
    });
    expect(list.getByLabelText<HTMLInputElement>('Nueva ancla').value).toBe('');
  });

  it('renames an anchor', async () => {
    const { user } = await renderRoute('/habitos');
    const list = await anchorList();
    await list.findByText('Tarde');

    await user.click(list.getByRole('button', { name: 'Renombrar Tarde' }));
    const input = list.getByLabelText('Nuevo nombre de Tarde');
    await user.clear(input);
    await user.type(input, 'Después de clases');
    await user.click(list.getByRole('button', { name: 'Guardar' }));

    expect(await list.findByText('Después de clases')).toBeTruthy();
    expect(list.queryByText('Tarde')).toBeNull();
  });

  it('moves an anchor with buttons', async () => {
    const { user } = await renderRoute('/habitos');
    const list = await anchorList();
    await list.findByText('Mañana');

    await user.click(list.getByRole('button', { name: 'Subir Mañana' }));
    await waitFor(() => {
      expect(listedNames(list).slice(0, 2)).toEqual(['Mañana', 'Al despertar']);
    });

    await user.click(list.getByRole('button', { name: 'Bajar Mañana' }));
    await waitFor(() => {
      expect(listedNames(list).slice(0, 2)).toEqual(['Al despertar', 'Mañana']);
    });
    expect(list.getByRole('button', { name: 'Subir Al despertar' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('will not archive an anchor that still has active habits', async () => {
    const { db, user } = await renderRoute('/habitos');
    const list = await anchorList();
    const evening = await db.anchors.filter((anchor) => anchor.name === 'Noche').first();
    if (!evening) throw new Error('missing anchors');
    await habitsRepo(db).create({
      name: 'Leer',
      description: null,
      mode: 'daily',
      weeklyQuota: null,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startsOn: parseLocalDate('2026-10-23'),
      anchorId: evening.id,
      color: 'default',
      icon: null,
    });

    await user.click(await list.findByRole('button', { name: 'Archivar Noche' }));
    expect((await list.findByRole('alert')).textContent).toBe(
      'Mueve sus hábitos a otra ancla primero.',
    );
    expect((await db.anchors.get(evening.id))?.archivedAt).toBeNull();

    await user.click(list.getByRole('button', { name: 'Archivar Tarde' }));
    await waitFor(() => {
      expect(listedNames(list)).not.toContain('Tarde');
    });
  });
});
