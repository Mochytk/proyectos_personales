import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { iconForType, mediaTypeLabelsES } from '@/constants/mediaTypes';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MEDIA_TYPES, STATUSES } from '@/store/enums';
import { STALE_DAY_OPTIONS, collectTags, statusLabelsES, toggleValue } from '@/store/smartLists';
import { SmartFilters, useStore } from '@/store/useStore';

interface Props {
  value: SmartFilters;
  onChange: (value: SmartFilters) => void;
}

/** Editor for the filters of a smart list: used when creating one and in the list's settings. */
export default function SmartFiltersEditor({ value, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const items = useStore((state) => state.items);
  const tags = collectTags(items);

  const pill = (key: string, label: string, selected: boolean, onPress: () => void, icon?: React.ReactNode) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: selected ? colors.tint : colors.cardBackground }]}
    >
      {icon}
      <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  const group = (title: string, hint: string | undefined, children: React.ReactNode) => (
    <View style={styles.group}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.text + '80' }]}>{hint}</Text> : null}
      <View style={styles.pills}>{children}</View>
    </View>
  );

  return (
    <View style={{ backgroundColor: 'transparent' }}>
      {group('Tipo', 'Sin elegir ninguno se incluyen todos.', MEDIA_TYPES.map((type) =>
        pill(type, mediaTypeLabelsES[type], !!value.types?.includes(type), () => onChange({ ...value, types: toggleValue(value.types, type) }),
          <SymbolView name={iconForType(type)} size={14} tintColor={value.types?.includes(type) ? '#fff' : colors.text} />),
      ))}

      {group('Estado', 'Sin elegir ninguno se incluye todo menos lo terminado.', STATUSES.map((status) =>
        pill(status, statusLabelsES[status], !!value.statuses?.includes(status), () => onChange({ ...value, statuses: toggleValue(value.statuses, status) })),
      ))}

      {group('Nota mínima', undefined, [
        pill('any', 'Cualquiera', value.minRating === undefined, () => onChange({ ...value, minRating: undefined })),
        ...[1, 2, 3, 4, 5].map((stars) =>
          pill(`stars-${stars}`, `${'★'.repeat(stars)}`, value.minRating === stars, () => onChange({ ...value, minRating: stars })),
        ),
      ])}

      {group('Etiquetas', tags.length === 0 ? 'Aún no has puesto etiquetas a ningún elemento.' : 'Elementos con alguna de las elegidas.', tags.map((tag) =>
        pill(tag, tag, !!value.tags?.some((t) => t.toLowerCase() === tag.toLowerCase()), () => {
          const has = value.tags?.some((t) => t.toLowerCase() === tag.toLowerCase());
          onChange({ ...value, tags: has ? (value.tags ?? []).filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...(value.tags ?? []), tag] });
        }),
      ))}

      {group('Sin tocar hace', 'Útil para encontrar lo que dejaste olvidado.', [
        pill('stale-any', 'Cualquiera', value.staleDays === undefined, () => onChange({ ...value, staleDays: undefined })),
        ...STALE_DAY_OPTIONS.map((days) => pill(`stale-${days}`, `${days} días o más`, value.staleDays === days, () => onChange({ ...value, staleDays: days }))),
      ])}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 22, backgroundColor: 'transparent' },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10, backgroundColor: 'transparent' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
});
