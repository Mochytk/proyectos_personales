import type { MediaType } from '@/store/useStore';

export const mediaTypeLabelsES: Record<MediaType, string> = {
  software: 'Software',
  task: 'Tareas',
  movie: 'Películas',
  tv_show: 'Series',
  book: 'Libros',
  audiobook: 'Audiolibros',
  video_game: 'Videojuegos',
  board_game: 'Juegos de Mesa',
  music_album: 'Música',
  app: 'Apps',
  event: 'Eventos',
  note: 'Notas',
};

type IconName = { ios: string; android: string; web: string };

// ios = SF Symbol; android/web = MaterialIcons name (see components/AppIcon.tsx).
export const mediaTypeIcons: Record<MediaType, IconName> = {
  software: { ios: 'desktopcomputer', android: 'computer', web: 'computer' },
  task: { ios: 'checkmark.circle', android: 'check-circle', web: 'check-circle' },
  movie: { ios: 'film', android: 'movie', web: 'movie' },
  tv_show: { ios: 'tv', android: 'tv', web: 'tv' },
  book: { ios: 'book.closed', android: 'book', web: 'book' },
  audiobook: { ios: 'headphones', android: 'headphones', web: 'headphones' },
  video_game: { ios: 'gamecontroller', android: 'gamepad', web: 'gamepad' },
  board_game: { ios: 'dice', android: 'casino', web: 'casino' },
  music_album: { ios: 'music.note', android: 'music-note', web: 'music-note' },
  app: { ios: 'app', android: 'apps', web: 'apps' },
  event: { ios: 'calendar', android: 'event', web: 'event' },
  note: { ios: 'note.text', android: 'sticky-note-2', web: 'sticky-note-2' },
};

/** Icon for a media type; unknown values (e.g. from an old backup) fall back to the generic one. */
export const iconForType = (type: string): IconName => mediaTypeIcons[type as MediaType] ?? mediaTypeIcons.software;
