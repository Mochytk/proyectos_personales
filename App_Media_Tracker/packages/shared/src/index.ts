export const MEDIA_KINDS = ['movie', 'series', 'game', 'book'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];
