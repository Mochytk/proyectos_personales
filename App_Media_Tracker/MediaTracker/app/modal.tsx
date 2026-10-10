import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, Image, ActivityIndicator, Switch } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore, MediaType } from '@/store/useStore';
import { router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';
import DateField from '@/components/DateField';
import { fromInputs } from '@/store/dates';
import { MetadataResult, providerFor } from '@/services/metadata';

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
  const settings = useStore(state => state.settings);
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
  const [dueDateString, setDueDateString] = useState(''); // YYYY-MM-DD
  const [dueTimeString, setDueTimeString] = useState(''); // HH:MM (optional)
  const [remind, setRemind] = useState(false);

  // Metadata search (TMDB, ...), for the media types that have a provider
  const provider = providerFor(type);
  const apiKey = (provider?.keySetting ? settings[provider.keySetting] : undefined)?.trim() ?? '';
  const needsKey = !!provider?.keySetting && !apiKey;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [picked, setPicked] = useState<MetadataResult | null>(null);

  const searchActive = !!provider && !needsKey && query.trim().length >= 2;

  useEffect(() => {
    if (!searchActive || !provider) return;
    const controller = new AbortController();
    // Debounced: nothing is requested (or shown) until the user pauses typing.
    const timer = setTimeout(() => {
      setSearching(true);
      setSearchError('');
      provider.search(query.trim(), apiKey, controller.signal)
        .then(setResults)
        .catch((e) => {
          if (e?.name === 'AbortError') return;
          setResults([]);
          setSearchError(e instanceof Error ? e.message : `No se pudo buscar en ${provider.label}.`);
        })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchActive, query, provider, apiKey]);

  const applyProgress = (progress: NonNullable<MetadataResult['progress']>) => {
    setProgressType(progress.type);
    if (progress.total) setTotalCheckpoints(String(progress.total));
  };

  const handlePick = (result: MetadataResult) => {
    setPicked(result);
    setTitle(result.title);
    setSubtitle(result.subtitle ?? '');
    setQuery('');
    setResults([]);
    if (result.progress) applyProgress(result.progress);
    if (provider?.details) {
      // A second request fills in what the search does not return; if it fails the user can type it.
      provider.details(result, apiKey)
        .then((extra) => { if (extra.progress) applyProgress(extra.progress); })
        .catch(() => {});
    }
  };

  const handleTypeChange = (newType: MediaType) => {
    setType(newType);
    setProgressType(getDefaultProgressType(newType));
    setTotalCheckpoints('');
    setPicked(null);
    setQuery('');
    setResults([]);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    
    let finalCheckpointType = undefined;
    if (progressType === 'percentage') {
      finalCheckpointType = 'percentage';
    } else if (progressType !== 'none') {
      finalCheckpointType = progressType === 'custom' ? customProgressLabel || 'steps' : progressType;
    }
    
    const due = fromInputs(dueDateString, dueTimeString);

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
      dueDate: due?.dueDate,
      dueHasTime: due?.dueHasTime,
      remind: due && remind ? true : undefined,
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

      {provider && (
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Buscar en {provider.label}</Text>
          {needsKey ? (
            <Text style={[styles.helpText, { color: colors.text + '80', marginTop: 0 }]}>{provider.keyHelp}</Text>
          ) : (
            <>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
                value={query}
                onChangeText={setQuery}
                placeholder={provider.placeholder}
                placeholderTextColor={colors.text + '80'}
              />
              {searchActive && searching && <ActivityIndicator style={{ marginTop: 12 }} color={colors.tint} />}
              {searchActive && searchError !== '' && <Text style={[styles.helpText, { color: '#ff3b30' }]}>{searchError}</Text>}
              {(searchActive ? results : []).map((r) => (
                <Pressable key={r.externalId} style={[styles.result, { backgroundColor: colors.cardBackground }]} onPress={() => handlePick(r)}>
                  {r.posterUrl ? (
                    <Image source={{ uri: r.posterUrl }} style={styles.resultPoster} />
                  ) : (
                    <View style={[styles.resultPoster, { backgroundColor: colors.tint + '15' }]} />
                  )}
                  <View style={{ flex: 1, backgroundColor: 'transparent' }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>{r.title}</Text>
                    {r.subtitle ? <Text style={{ color: colors.text + '80', marginTop: 2 }}>{r.subtitle}</Text> : null}
                  </View>
                </Pressable>
              ))}
              {picked && (
                <Text style={[styles.helpText, { color: colors.text + '80' }]}>Seleccionado: {picked.title}{picked.subtitle ? ` (${picked.subtitle})` : ''}</Text>
              )}
            </>
          )}
        </View>
      )}

      {/* Date / Reminder Options */}
      <Text style={[styles.label, { color: colors.text, marginTop: 30 }]}>Fecha Programada (Opcional)</Text>
      <DateField
        date={dueDateString}
        time={dueTimeString}
        onChange={({ date, time }) => { setDueDateString(date); setDueTimeString(time); }}
      />
      <Text style={[styles.helpText, { color: colors.text + '80' }]}>
        Añadir una fecha enviará este elemento a tu Planificador. La hora es opcional.
      </Text>
      {dueDateString !== '' && (
        <View style={styles.remindRow}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Recordarme</Text>
          <Switch value={remind} onValueChange={setRemind} trackColor={{ true: colors.tint }} />
        </View>
      )}

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
  remindRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, backgroundColor: 'transparent' },
  saveButton: { marginTop: 40, padding: 16, borderRadius: 25, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
