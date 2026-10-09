import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, Platform, Image, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore, MediaType } from '@/store/useStore';
import { useNavigation, router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';
import { TmdbResult, getTvEpisodeCount, searchTmdb } from '@/services/tmdb';

const mediaTypes: { label: string; value: MediaType; icon: string }[] = [
  { label: 'Software', value: 'software', icon: 'desktopcomputer' },
  { label: 'Tarea', value: 'task', icon: 'checkmark.circle' },
  { label: 'Película', value: 'movie', icon: 'film' },
  { label: 'Serie', value: 'tv_show', icon: 'tv' },
  { label: 'Libro', value: 'book', icon: 'book.closed' },
  { label: 'Juego', value: 'video_game', icon: 'gamecontroller' },
  { label: 'Evento', value: 'event', icon: 'calendar' },
];

const progressTypes = [
  { label: 'Ninguno (To-Do simple)', value: 'none' },
  { label: 'Episodios', value: 'episodes' },
  { label: 'Capítulos', value: 'chapters' },
  { label: 'Páginas', value: 'pages' },
  { label: 'Niveles', value: 'levels' },
  { label: 'Porcentaje (%)', value: 'percentage' },
  { label: 'Personalizado', value: 'custom' },
];

const getDefaultProgressType = (type: MediaType) => {
  switch (type) {
    case 'tv_show': return 'episodes';
    case 'book': return 'pages';
    case 'video_game': return 'levels';
    case 'task': 
    case 'event': return 'none';
    default: return 'none';
  }
};

export default function ModalScreen() {
  const addItem = useStore(state => state.addItem);
  const lists = useStore(state => state.lists);
  const tmdbApiKey = useStore(state => state.settings.tmdbApiKey)?.trim();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [type, setType] = useState<MediaType>('software');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Progress Tracking State
  const [progressType, setProgressType] = useState<string>('none');
  const [customProgressLabel, setCustomProgressLabel] = useState('');
  const [totalCheckpoints, setTotalCheckpoints] = useState('');
  
  // Reminders
  const [dueDateString, setDueDateString] = useState(''); // YYYY-MM-DD format

  // TMDB metadata (movies and TV shows only)
  const tmdbKind = type === 'movie' ? 'movie' : type === 'tv_show' ? 'tv' : null;
  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TmdbResult[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState('');
  const [picked, setPicked] = useState<TmdbResult | null>(null);

  useEffect(() => {
    setTmdbError('');
    if (!tmdbKind || !tmdbApiKey || tmdbQuery.trim().length < 2) {
      setTmdbResults([]);
      setTmdbLoading(false);
      return;
    }
    const controller = new AbortController();
    setTmdbLoading(true);
    const timer = setTimeout(() => {
      searchTmdb(tmdbKind, tmdbQuery.trim(), tmdbApiKey, controller.signal)
        .then(setTmdbResults)
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setTmdbResults([]);
          setTmdbError(e instanceof Error ? e.message : 'No se pudo buscar en TMDB.');
        })
        .finally(() => { if (!controller.signal.aborted) setTmdbLoading(false); });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tmdbQuery, tmdbKind, tmdbApiKey]);

  const handlePick = (result: TmdbResult) => {
    setPicked(result);
    setTitle(result.title);
    setSubtitle(result.year ?? '');
    setTmdbQuery('');
    setTmdbResults([]);
    if (result.kind === 'tv' && tmdbApiKey) {
      // Pre-fill episode tracking; if this fails the user can still type the total by hand.
      setProgressType('episodes');
      getTvEpisodeCount(result.externalId, tmdbApiKey)
        .then((n) => { if (n) setTotalCheckpoints(String(n)); })
        .catch(() => {});
    }
  };

  const handleTypeChange = (newType: MediaType) => {
    setType(newType);
    setProgressType(getDefaultProgressType(newType));
    setTotalCheckpoints('');
    setPicked(null);
    setTmdbQuery('');
    setTmdbResults([]);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    
    let finalCheckpointType = undefined;
    if (progressType === 'percentage') {
      finalCheckpointType = 'percentage';
    } else if (progressType !== 'none') {
      finalCheckpointType = progressType === 'custom' ? customProgressLabel || 'steps' : progressType;
    }
    
    // Parse YYYY-MM-DD as a LOCAL date. Date.parse() treats it as UTC midnight,
    // which shows up as the previous day in negative-offset timezones (e.g. Chile).
    let parsedDueDate = undefined;
    const dateMatch = dueDateString.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateMatch) {
      const d = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      if (!isNaN(d.getTime())) parsedDueDate = d.getTime();
    }

    let parsedTotal: number | undefined = undefined;
    if (progressType === 'percentage') {
      parsedTotal = 100;
    } else if (progressType !== 'none' && totalCheckpoints.trim()) {
      const n = parseInt(totalCheckpoints, 10);
      if (!isNaN(n) && n > 0) parsedTotal = n;
    }
    
    addItem({
      title: title.trim(),
      subtitle: subtitle.trim(),
      type,
      status: 'unstarted',
      progress: 0,
      totalCheckpoints: parsedTotal,
      currentCheckpoint: 0,
      checkpointType: finalCheckpointType as any,
      listId: selectedListId || undefined,
      dueDate: parsedDueDate,
      externalId: picked?.externalId,
      posterUrl: picked?.posterUrl,
      overview: picked?.overview,
      releaseDate: picked?.releaseDate,
    });
    
    router.back();
  };

  const translateProgressType = (pt: string) => {
    const translations: any = {
      'episodes': 'Episodios',
      'chapters': 'Capítulos',
      'pages': 'Páginas',
      'levels': 'Niveles'
    };
    return translations[pt] || pt.charAt(0).toUpperCase() + pt.slice(1);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
      <Text style={[styles.label, { color: colors.text }]}>Título</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
        value={title}
        onChangeText={setTitle}
        placeholder="Escribe el título..."
        placeholderTextColor={colors.text + '80'}
        autoFocus
      />
      
      <Text style={[styles.label, { color: colors.text }]}>Subtítulo / Autor (Opcional)</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
        value={subtitle}
        onChangeText={setSubtitle}
        placeholder="Escribe el subtítulo..."
        placeholderTextColor={colors.text + '80'}
      />
      
      <Text style={[styles.label, { color: colors.text }]}>Tipo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {mediaTypes.map((mt) => (
          <Pressable
            key={mt.value}
            style={[
              styles.pill,
              { backgroundColor: type === mt.value ? colors.tint : colors.cardBackground }
            ]}
            onPress={() => handleTypeChange(mt.value)}
          >
            <SymbolView name={mt.icon as any} size={16} tintColor={type === mt.value ? '#fff' : colors.text} />
            <Text style={[styles.pillText, { color: type === mt.value ? '#fff' : colors.text }]}>{mt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tmdbKind && (
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Buscar en TMDB</Text>
          {!tmdbApiKey ? (
            <Text style={[styles.helpText, { color: colors.text + '80', marginTop: 0 }]}>
              Añade tu clave gratuita de TMDB en Ajustes Globales para rellenar título, portada y episodios automáticamente.
            </Text>
          ) : (
            <>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
                value={tmdbQuery}
                onChangeText={setTmdbQuery}
                placeholder={tmdbKind === 'movie' ? 'Busca una película...' : 'Busca una serie...'}
                placeholderTextColor={colors.text + '80'}
              />
              {tmdbLoading && <ActivityIndicator style={{ marginTop: 12 }} color={colors.tint} />}
              {tmdbError !== '' && <Text style={[styles.helpText, { color: '#ff3b30' }]}>{tmdbError}</Text>}
              {tmdbResults.map((r) => (
                <Pressable key={r.externalId} style={[styles.result, { backgroundColor: colors.cardBackground }]} onPress={() => handlePick(r)}>
                  {r.posterUrl ? (
                    <Image source={{ uri: r.posterUrl }} style={styles.resultPoster} />
                  ) : (
                    <View style={[styles.resultPoster, { backgroundColor: colors.tint + '15' }]} />
                  )}
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>{r.title}</Text>
                    {r.year ? <Text style={{ color: colors.text + '80', marginTop: 2 }}>{r.year}</Text> : null}
                  </View>
                </Pressable>
              ))}
              {picked && (
                <Text style={[styles.helpText, { color: colors.text + '80' }]}>Seleccionado: {picked.title}{picked.year ? ` (${picked.year})` : ''}</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Date / Reminder Options */}
      <Text style={[styles.label, { color: colors.text, marginTop: 30 }]}>Fecha Programada (Opcional)</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
        value={dueDateString}
        onChangeText={setDueDateString}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.text + '80'}
      />
      <Text style={[styles.helpText, { color: colors.text + '80' }]}>
        Añadir una fecha enviará este elemento a tu Planificador.
      </Text>

      {/* Progress Tracking Options */}
      <Text style={[styles.label, { color: colors.text, marginTop: 30 }]}>¿Cómo mides tu progreso?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        {progressTypes.map((pt) => (
          <Pressable
            key={pt.value}
            style={[
              styles.pill,
              { backgroundColor: progressType === pt.value ? colors.tint : colors.cardBackground }
            ]}
            onPress={() => setProgressType(pt.value)}
          >
            <Text style={[styles.pillText, { color: progressType === pt.value ? '#fff' : colors.text, marginLeft: 0 }]}>{pt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {progressType === 'custom' && (
        <View style={{ marginTop: 15 }}>
          <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Medida Personalizada (ej. Jefes, Misiones)</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
            value={customProgressLabel}
            onChangeText={setCustomProgressLabel}
            placeholder="ej. Jefes"
            placeholderTextColor={colors.text + '80'}
          />
        </View>
      )}

      {progressType !== 'none' && progressType !== 'percentage' && (
        <View style={{ marginTop: 15 }}>
          <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>
            Total de {progressType === 'custom' ? (customProgressLabel || 'Pasos') : translateProgressType(progressType)} (Opcional)
          </Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
            value={totalCheckpoints}
            onChangeText={setTotalCheckpoints}
            placeholder={`ej. 12`}
            placeholderTextColor={colors.text + '80'}
            keyboardType="numeric"
          />
        </View>
      )}

      {progressType === 'percentage' && (
        <Text style={[styles.helpText, { color: colors.text + '80' }]}>
          Se mostrarán botones para avanzar de 0% a 100%.
        </Text>
      )}

      <Text style={[styles.label, { color: colors.text, marginTop: 30 }]}>Guardar en Lista</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        <Pressable
          style={[styles.pill, { backgroundColor: selectedListId === null ? colors.tint : colors.cardBackground }]}
          onPress={() => setSelectedListId(null)}
        >
          <SymbolView name={{ ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' }} size={16} tintColor={selectedListId === null ? '#fff' : colors.text} />
          <Text style={[styles.pillText, { color: selectedListId === null ? '#fff' : colors.text }]}>La Pila</Text>
        </Pressable>
        {lists.map((list) => {
          if (list.isSmartList) return null;
          return (
            <Pressable
              key={list.id}
              style={[styles.pill, { backgroundColor: selectedListId === list.id ? colors.tint : colors.cardBackground }]}
              onPress={() => setSelectedListId(list.id)}
            >
              <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} size={16} tintColor={selectedListId === list.id ? '#fff' : colors.text} />
              <Text style={[styles.pillText, { color: selectedListId === list.id ? '#fff' : colors.text }]}>{list.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <Pressable 
        style={[styles.saveButton, { backgroundColor: title.trim() ? colors.tint : colors.text + '40' }]} 
        onPress={handleSave}
        disabled={!title.trim()}
      >
        <Text style={styles.saveButtonText}>Guardar Elemento</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 25, marginBottom: 10 },
  helpText: { fontSize: 14, marginTop: 8, fontStyle: 'italic' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  horizontalScroll: { flexDirection: 'row', maxHeight: 50 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 10 },
  pillText: { marginLeft: 6, fontWeight: '500' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, marginTop: 8 },
  resultPoster: { width: 40, height: 60, borderRadius: 6 },
  saveButton: { marginTop: 40, padding: 16, borderRadius: 25, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
