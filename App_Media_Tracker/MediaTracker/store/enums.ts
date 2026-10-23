import type { MediaItem, MediaType } from './useStore';

export const MEDIA_TYPES: MediaType[] = ['software', 'task', 'movie', 'tv_show', 'book', 'audiobook', 'video_game', 'board_game', 'music_album', 'app', 'event', 'note'];
export const STATUSES: MediaItem['status'][] = ['unstarted', 'in_progress', 'completed', 'abandoned'];
