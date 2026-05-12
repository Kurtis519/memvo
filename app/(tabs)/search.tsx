import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import {
  type MemvoSearchDateRange,
  type MemvoSearchFilters,
  buildHighlightParts,
  getFolderNoteCount,
  searchNotes,
} from '@/lib/memvo-organization';
import { useMemvo } from '@/lib/memvo-store';
import { buildFeedTimestampLabel } from '@/lib/memvo-recording-utils';

const TEAL = '#0F6E56';
const TEAL_TINT = '#E1F5EE';
const HIGHLIGHT = '#FEF08A';

const DATE_FILTERS: Array<{ label: string; value: MemvoSearchDateRange }> = [
  { label: 'Any time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
];

function renderHighlightedText(text: string, query: string, muted = false) {
  return buildHighlightParts(text, query).map((part, index) => (
    <Text
      key={`${text}-${index}`}
      style={
        part.highlighted
          ? {
              backgroundColor: HIGHLIGHT,
              color: '#14532D',
              fontWeight: '700',
            }
          : muted
            ? { color: '#687076' }
            : { color: '#11181C' }
      }
    >
      {part.text}
    </Text>
  ));
}

function FilterChip({
  label,
  active,
  onPress,
  subtle = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  subtle?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.82}
      onPress={onPress}
      style={{
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: active ? TEAL : subtle ? '#FFFFFF' : TEAL_TINT,
        borderWidth: subtle ? 1 : 0,
        borderColor: '#D6E4DE',
      }}
    >
      <Text style={{ color: active ? '#FFFFFF' : TEAL, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const { tag } = useLocalSearchParams<{ tag?: string }>();
  const { folders, notes, recentSearches, removeRecentSearch, saveRecentSearch } = useMemvo();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<MemvoSearchFilters>({
    tag: null,
    folderId: null,
    dateRange: 'all',
    customStart: null,
    customEnd: null,
  });

  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (typeof tag !== 'string') {
      return;
    }

    const normalized = tag.trim().replace(/^#/, '');
    setFilters((current) => ({ ...current, tag: normalized || null }));
  }, [tag]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        const normalized = tag.trim().replace(/^#/, '');
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [notes]);

  const results = useMemo(() => searchNotes(notes, debouncedQuery, filters, folders), [debouncedQuery, filters, folders, notes]);
  const hasQuery = debouncedQuery.trim().length >= 2;

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.tag) parts.push(`#${filters.tag}`);
    if (filters.folderId) {
      const folderName = folders.find((folder) => folder.id === filters.folderId)?.name;
      if (folderName) parts.push(folderName);
    }
    if (filters.dateRange !== 'all') {
      const label = DATE_FILTERS.find((item) => item.value === filters.dateRange)?.label;
      if (label) parts.push(label);
    }
    return parts;
  }, [filters, folders]);

  return (
    <ScreenContainer className="bg-background px-5 pt-3">
      <FlatList
        data={results}
        keyExtractor={(item) => item.note.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 48 }}
        ListHeaderComponent={
          <View className="gap-5 pb-5">
            <View className="gap-2">
              <Text className="text-3xl font-bold text-foreground">Search</Text>
              <Text className="text-base leading-6 text-muted">
                Search titles, transcripts, summaries, tags, and folders in one place.
              </Text>
            </View>

            <View className="rounded-[24px] border border-border bg-surface px-4 py-2">
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search transcripts, summaries, or tags"
                placeholderTextColor="#8A9198"
                className="py-3 text-base text-foreground"
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (query.trim().length >= 2) {
                    saveRecentSearch(query);
                  }
                }}
              />
            </View>

            {activeFilterSummary.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {activeFilterSummary.map((label) => (
                  <View key={label} className="rounded-full bg-[#D6F1E8] px-3 py-2">
                    <Text className="text-xs font-semibold text-primary">{label}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  onPress={() =>
                    setFilters({
                      tag: null,
                      folderId: null,
                      dateRange: 'all',
                      customStart: null,
                      customEnd: null,
                    })
                  }
                  className="rounded-full bg-background px-3 py-2"
                >
                  <Text className="text-xs font-semibold text-muted">Clear filters</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Tags</Text>
              <FlatList
                data={allTags}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <FilterChip
                    label={`#${item}`}
                    active={filters.tag === item}
                    onPress={() => setFilters((current) => ({ ...current, tag: current.tag === item ? null : item }))}
                  />
                )}
              />
            </View>

            <View className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Date</Text>
              <FlatList
                data={DATE_FILTERS}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.value}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <FilterChip
                    label={item.label}
                    active={filters.dateRange === item.value}
                    onPress={() => setFilters((current) => ({ ...current, dateRange: item.value }))}
                  />
                )}
              />
            </View>

            <View className="gap-3">
              <Text className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">Folders</Text>
              <FlatList
                data={folders}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <FilterChip
                    label={`${item.name} · ${getFolderNoteCount(item, notes)}`}
                    active={filters.folderId === item.id}
                    onPress={() => setFilters((current) => ({ ...current, folderId: current.folderId === item.id ? null : item.id }))}
                    subtle
                  />
                )}
              />
            </View>

            {!hasQuery ? (
              <View className="rounded-[28px] border border-border bg-surface p-5">
                <Text className="text-base font-semibold text-foreground">Recent searches</Text>
                {recentSearches.length > 0 ? (
                  <View className="mt-4 gap-3">
                    {recentSearches.map((item) => (
                      <View key={item} className="flex-row items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
                        <TouchableOpacity
                          accessibilityRole="button"
                          activeOpacity={0.8}
                          onPress={() => setQuery(item)}
                          className="flex-1"
                        >
                          <Text className="text-sm font-medium text-foreground">{item}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} onPress={() => removeRecentSearch(item)}>
                          <Text className="text-xs font-semibold text-muted">Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="mt-3 text-sm leading-6 text-muted">
                    Start typing at least two characters and Memvo will keep your last five searches here.
                  </Text>
                )}
              </View>
            ) : null}

            {hasQuery ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-foreground">
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                </Text>
                {isSearching ? <ActivityIndicator size="small" color={TEAL} /> : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          hasQuery ? (
            <View className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10">
              <Text className="text-center text-base font-semibold text-foreground">No matches yet</Text>
              <Text className="mt-2 text-center text-sm leading-6 text-muted">
                Try a different keyword or clear one of the active filters.
              </Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={() => {
              saveRecentSearch(debouncedQuery);
              router.push(`/note/${item.note.id}`);
            }}
            className="rounded-[28px] border border-border bg-surface p-4"
          >
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1 gap-1">
                <Text numberOfLines={1} className="text-base font-semibold text-foreground">
                  {renderHighlightedText(item.note.title, debouncedQuery)}
                </Text>
                <Text className="text-sm text-muted">{buildFeedTimestampLabel(new Date(item.note.recordedAt))}</Text>
              </View>
              <View className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                <Text className="text-xs font-semibold text-primary">{item.matchedField}</Text>
              </View>
            </View>

            <Text numberOfLines={3} className="mt-3 text-sm leading-6 text-muted">
              {renderHighlightedText(item.snippet, debouncedQuery, true)}
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {item.note.tags.slice(0, 3).map((tag) => (
                <View key={`${item.note.id}-${tag}`} className="rounded-full bg-[#EEF8F4] px-3 py-1.5">
                  <Text className="text-xs font-medium text-primary">#{tag}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}
