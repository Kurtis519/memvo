import type { MemvoFolder, MemvoNote } from '@/lib/memvo-domain';

export const MEMVO_FOLDERS_STORAGE_KEY = 'memvo:folders:v1';
export const MEMVO_RECENT_SEARCHES_STORAGE_KEY = 'memvo:recent-searches:v1';
export const MEMVO_MAX_FREE_CUSTOM_FOLDERS = 3;
export const MEMVO_MAX_FOLDER_NAME_LENGTH = 30;

export type MemvoSearchDateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

export type MemvoSearchFilters = {
  tag: string | null;
  folderId: string | null;
  dateRange: MemvoSearchDateRange;
  customStart: string | null;
  customEnd: string | null;
};

export type MemvoTimelineSection = {
  title: string;
  data: MemvoNote[];
};

export type MemvoSearchPart = {
  text: string;
  highlighted: boolean;
};

export type MemvoSearchResult = {
  note: MemvoNote;
  snippet: string;
  titleMatches: boolean;
  matchedField: 'title' | 'transcript' | 'summary' | 'tags';
};

export type MemvoMoodTone = 'positive' | 'reflective' | 'excited' | 'stressed' | 'focused' | 'grateful' | 'uncertain';

export type MemvoMoodAppearance = {
  tone: MemvoMoodTone;
  label: string;
  backgroundColor: string;
  textColor: string;
};

export type MemvoMoodInsight = {
  tone: MemvoMoodTone;
  label: string;
  count: number;
  backgroundColor: string;
  textColor: string;
};

export type MemvoWeeklyMoodInsights = {
  dominant: MemvoMoodInsight | null;
  items: MemvoMoodInsight[];
  summary: string | null;
};

export type MemvoTopicCluster = {
  id: string;
  label: string;
  count: number;
};

const DEFAULT_FOLDER_DEFINITIONS = [
  { name: 'All Notes', slug: 'all-notes' },
  { name: 'Starred', slug: 'starred' },
  { name: 'Journals', slug: 'journals' },
  { name: 'Meetings', slug: 'meetings' },
  { name: 'Ideas', slug: 'ideas' },
] as const;

const MEMVO_MOOD_APPEARANCES: Record<MemvoMoodTone, MemvoMoodAppearance> = {
  positive: { tone: 'positive', label: 'Positive', backgroundColor: '#EAF3DE', textColor: '#27500A' },
  reflective: { tone: 'reflective', label: 'Reflective', backgroundColor: '#EEEDFE', textColor: '#3C3489' },
  excited: { tone: 'excited', label: 'Excited', backgroundColor: '#FAEEDA', textColor: '#633806' },
  stressed: { tone: 'stressed', label: 'Stressed', backgroundColor: '#FCEBEB', textColor: '#791F1F' },
  focused: { tone: 'focused', label: 'Focused', backgroundColor: '#E6F1FB', textColor: '#0C447C' },
  grateful: { tone: 'grateful', label: 'Grateful', backgroundColor: '#E1F5EE', textColor: '#085041' },
  uncertain: { tone: 'uncertain', label: 'Uncertain', backgroundColor: '#F5F5F5', textColor: '#555555' },
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeTag(tag: string) {
  return tag.trim().replace(/^#/, '').toLowerCase();
}

function normalizeMoodTone(mood: string | null | undefined): MemvoMoodTone | null {
  if (!mood) {
    return null;
  }

  const normalized = mood.trim().toLowerCase();
  if (!normalized || normalized === 'neutral') {
    return null;
  }

  return normalized in MEMVO_MOOD_APPEARANCES ? (normalized as MemvoMoodTone) : null;
}

export function isJournalStyleNote(note: MemvoNote) {
  return note.tags.some((tag) => normalizeTag(tag) === 'journal' || normalizeTag(tag) === 'journals');
}

export function getMoodAppearance(mood: string | null | undefined): MemvoMoodAppearance | null {
  const tone = normalizeMoodTone(mood);
  return tone ? MEMVO_MOOD_APPEARANCES[tone] : null;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function slugifyFolderName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MEMVO_MAX_FOLDER_NAME_LENGTH) || 'folder';
}

export function sanitizeFolderName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, MEMVO_MAX_FOLDER_NAME_LENGTH);
}

export function buildDefaultFolders(userId: string, timestamp = new Date().toISOString()): MemvoFolder[] {
  return DEFAULT_FOLDER_DEFINITIONS.map((definition, index) => ({
    id: `${definition.slug}-${userId}`,
    userId,
    name: definition.name,
    slug: definition.slug,
    kind: 'system',
    position: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

export function ensureDefaultFolders(folders: MemvoFolder[], userId: string) {
  const timestamp = new Date().toISOString();
  const seeded = buildDefaultFolders(userId, timestamp);
  const bySlug = new Map(folders.map((folder) => [folder.slug, folder]));

  const merged = seeded.map((folder, index) => {
    const existing = bySlug.get(folder.slug);
    if (!existing) {
      return folder;
    }

    return {
      ...existing,
      userId,
      name: folder.name,
      slug: folder.slug,
      kind: 'system',
      position: index,
    } satisfies MemvoFolder;
  });

  const customFolders = folders
    .filter((folder) => !DEFAULT_FOLDER_DEFINITIONS.some((definition) => definition.slug === folder.slug))
    .map((folder, index) => ({
      ...folder,
      userId,
      kind: 'custom' as const,
      position: seeded.length + index,
    }));

  return [...merged, ...customFolders].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function normalizeStoredFolders(raw: unknown, userId: string) {
  const now = new Date().toISOString();
  if (!Array.isArray(raw)) {
    return buildDefaultFolders(userId, now);
  }

  const folders = raw
    .map((entry, index) => {
      const current = entry as Partial<MemvoFolder>;
      const name = sanitizeFolderName(typeof current.name === 'string' ? current.name : 'Folder');
      const slug = typeof current.slug === 'string' && current.slug.trim() ? current.slug : slugifyFolderName(name);
      return {
        id: typeof current.id === 'string' && current.id.trim() ? current.id : createId('folder'),
        userId,
        name,
        slug,
        kind: current.kind === 'system' ? 'system' : 'custom',
        position: typeof current.position === 'number' ? current.position : index,
        createdAt: typeof current.createdAt === 'string' ? current.createdAt : now,
        updatedAt: typeof current.updatedAt === 'string' ? current.updatedAt : now,
      } satisfies MemvoFolder;
    })
    .filter((folder) => folder.name.length > 0);

  return ensureDefaultFolders(folders, userId);
}

export function countCustomFolders(folders: MemvoFolder[]) {
  return folders.filter((folder) => folder.kind === 'custom').length;
}

export function getFolderNoteCount(folder: MemvoFolder, notes: MemvoNote[]) {
  if (folder.slug === 'all-notes') {
    return notes.length;
  }

  if (folder.slug === 'starred') {
    return notes.filter((note) => note.isStarred).length;
  }

  return notes.filter((note) => note.folderId === folder.id).length;
}

export function buildRecentSearches(current: string[], term: string) {
  const normalized = term.trim();
  if (normalized.length < 2) {
    return current;
  }

  return [normalized, ...current.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
}

export function removeRecentSearch(current: string[], term: string) {
  return current.filter((entry) => entry.toLowerCase() !== term.trim().toLowerCase());
}

export function getSuggestedTags(notes: MemvoNote[], currentTags: string[] = []) {
  const current = new Set(currentTags.map(normalizeTag));
  const counts = new Map<string, number>();

  for (const note of notes) {
    for (const tag of note.tags) {
      const normalized = normalizeTag(tag);
      if (!normalized || current.has(normalized)) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag]) => tag);
}

export function matchesDateRange(note: MemvoNote, filters: MemvoSearchFilters, now = new Date()) {
  const recordedAt = new Date(note.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    return false;
  }

  const todayStart = startOfDay(now).getTime();
  const noteTime = recordedAt.getTime();

  switch (filters.dateRange) {
    case 'today':
      return noteTime >= todayStart;
    case 'week': {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      return noteTime >= weekStart.getTime();
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return noteTime >= monthStart;
    }
    case 'custom': {
      const start = filters.customStart ? new Date(filters.customStart).getTime() : Number.NEGATIVE_INFINITY;
      const end = filters.customEnd ? new Date(filters.customEnd).getTime() : Number.POSITIVE_INFINITY;
      return noteTime >= start && noteTime <= end;
    }
    case 'all':
    default:
      return true;
  }
}

export function filterNotesByFilters(notes: MemvoNote[], filters: MemvoSearchFilters, folders: MemvoFolder[] = [], now = new Date()) {
  const folder = filters.folderId ? folders.find((entry) => entry.id === filters.folderId) ?? null : null;

  return notes.filter((note) => {
    if (filters.tag && !note.tags.some((tag) => normalizeTag(tag) === normalizeTag(filters.tag ?? ''))) {
      return false;
    }

    if (folder) {
      if (folder.slug === 'starred') {
        if (!note.isStarred) {
          return false;
        }
      } else if (folder.slug !== 'all-notes' && note.folderId !== folder.id) {
        return false;
      }
    }

    return matchesDateRange(note, filters, now);
  });
}

export function buildHighlightParts(text: string, query: string): MemvoSearchPart[] {
  if (!text) {
    return [];
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return [{ text, highlighted: false }];
  }

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
  return text.split(regex).filter(Boolean).map((part) => ({
    text: part,
    highlighted: part.toLowerCase() === trimmed.toLowerCase(),
  }));
}

function buildContextSnippet(text: string, query: string) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const lower = trimmed.toLowerCase();
  const search = query.trim().toLowerCase();
  const matchIndex = lower.indexOf(search);

  if (matchIndex === -1) {
    return trimmed.slice(0, 180);
  }

  const start = Math.max(0, matchIndex - 70);
  const end = Math.min(trimmed.length, matchIndex + search.length + 90);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < trimmed.length ? '…' : '';
  return `${prefix}${trimmed.slice(start, end).trim()}${suffix}`;
}

export function buildSearchResult(note: MemvoNote, query: string): MemvoSearchResult | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const tagsText = note.tags.join(' ');
  const titleMatches = note.title.toLowerCase().includes(lower);

  if (titleMatches) {
    return {
      note,
      snippet: buildContextSnippet(note.transcript || note.summary || tagsText || note.title, trimmed),
      titleMatches: true,
      matchedField: 'title',
    };
  }

  if ((note.transcript || '').toLowerCase().includes(lower)) {
    return {
      note,
      snippet: buildContextSnippet(note.transcript || '', trimmed),
      titleMatches: false,
      matchedField: 'transcript',
    };
  }

  if ((note.summary || '').toLowerCase().includes(lower)) {
    return {
      note,
      snippet: buildContextSnippet(note.summary || '', trimmed),
      titleMatches: false,
      matchedField: 'summary',
    };
  }

  if (tagsText.toLowerCase().includes(lower)) {
    return {
      note,
      snippet: `Tags: ${note.tags.join(', ')}`,
      titleMatches: false,
      matchedField: 'tags',
    };
  }

  return null;
}

export function searchNotes(notes: MemvoNote[], query: string, filters: MemvoSearchFilters, folders: MemvoFolder[] = [], now = new Date()) {
  const trimmed = query.trim();
  const filtered = filterNotesByFilters(notes, filters, folders, now);
  if (trimmed.length < 2) {
    return [];
  }

  return filtered
    .map((note) => buildSearchResult(note, trimmed))
    .filter((result): result is MemvoSearchResult => Boolean(result))
    .sort((a, b) => {
      const aScore = a.titleMatches ? 3 : a.matchedField === 'transcript' ? 2 : 1;
      const bScore = b.titleMatches ? 3 : b.matchedField === 'transcript' ? 2 : 1;
      return bScore - aScore || Date.parse(b.note.recordedAt) - Date.parse(a.note.recordedAt);
    });
}

export function buildTimelineSections(notes: MemvoNote[], now = new Date()): MemvoTimelineSection[] {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const grouped = new Map<string, MemvoNote[]>();

  const sorted = [...notes].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));

  for (const note of sorted) {
    const recordedAt = new Date(note.recordedAt);
    let title = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(recordedAt);

    if (recordedAt >= today) {
      title = 'Today';
    } else if (recordedAt >= yesterday) {
      title = 'Yesterday';
    } else if (recordedAt >= weekStart) {
      title = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(recordedAt);
    } else if (recordedAt >= monthStart) {
      title = 'Earlier this month';
    }

    grouped.set(title, [...(grouped.get(title) ?? []), note]);
  }

  return [...grouped.entries()].map(([title, data]) => ({ title, data }));
}

export function buildRecentActivity(notes: MemvoNote[], now = new Date()) {
  const todayStart = startOfDay(now).getTime();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const todayNotes = notes.filter((note) => Date.parse(note.recordedAt) >= todayStart);
  const weekNotes = notes.filter((note) => Date.parse(note.recordedAt) >= weekStart.getTime());

  return {
    today: {
      count: todayNotes.length,
      totalMinutes: Math.round(todayNotes.reduce((sum, note) => sum + note.durationSeconds, 0) / 60),
    },
    week: {
      count: weekNotes.length,
      totalMinutes: Math.round(weekNotes.reduce((sum, note) => sum + note.durationSeconds, 0) / 60),
    },
  };
}

export function buildTopicClusters(notes: MemvoNote[], options?: { max?: number; minTotalNotes?: number }) {
  const max = options?.max ?? 8;
  const minTotalNotes = options?.minTotalNotes ?? 5;

  if (notes.length < minTotalNotes) {
    return [] as MemvoTopicCluster[];
  }

  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of note.tags) {
      const normalized = tag.trim().replace(/^#/, '');
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, max);
}

export function buildWeeklyMoodInsights(notes: MemvoNote[], now = new Date()): MemvoWeeklyMoodInsights {
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const counts = new Map<MemvoMoodTone, number>();
  for (const note of notes) {
    if (Date.parse(note.recordedAt) < weekStart.getTime()) {
      continue;
    }

    const tone = normalizeMoodTone(note.mood);
    if (!tone) {
      continue;
    }

    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }

  const items = [...counts.entries()]
    .map(([tone, count]) => ({
      ...MEMVO_MOOD_APPEARANCES[tone],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const dominant = items[0] ?? null;
  const summary = dominant
    ? `This week: mostly ${dominant.label} (${dominant.count} ${dominant.count === 1 ? 'note' : 'notes'})${items
        .slice(1)
        .map((item) => ` · ${item.count} ${item.label}`)
        .join('')}`
    : null;

  return {
    dominant,
    items,
    summary,
  };
}
