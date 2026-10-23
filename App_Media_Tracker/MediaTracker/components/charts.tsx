import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface BarDatum {
  /** Short label under the bar ("E", "2026"). */
  label: string;
  /** Full description for the caption and screen readers ("Enero"). */
  name: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Singular and plural for the caption, e.g. ["elemento", "elementos"]. */
  unit: [string, string];
}

const plural = (n: number, unit: [string, string]) => `${n} ${n === 1 ? unit[0] : unit[1]}`;

/**
 * Vertical bars from a common baseline, one hue. The tallest bar is solid and the others softer, and
 * pressing a bar shows its exact value in the caption, so no number is drawn on every bar.
 */
export function BarChart({ data, height = 140, unit }: BarChartProps) {
  const colors = Colors[useColorScheme()];
  const [selected, setSelected] = useState<number | undefined>();
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const shown = selected ?? (data[peak].value > 0 ? peak : undefined);

  return (
    <View style={{ backgroundColor: 'transparent' }}>
      <Text style={[styles.caption, { color: colors.text + 'B0' }]}>
        {shown !== undefined ? `${data[shown].name}: ${plural(data[shown].value, unit)}` : 'Sin datos'}
      </Text>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => {
          const active = i === (shown ?? -1);
          return (
            <Pressable
              key={`${d.name}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${d.name}: ${plural(d.value, unit)}`}
              onPress={() => setSelected(i === selected ? undefined : i)}
              style={styles.column}
            >
              <View style={styles.barSlot}>
                {d.value > 0 && (
                  <View
                    style={[
                      styles.bar,
                      { height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: colors.tint, opacity: active ? 1 : 0.55 },
                    ]}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.baseline, { backgroundColor: colors.text + '25' }]} />
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={`${d.name}-${i}`} style={[styles.axisLabel, { color: colors.text + '80' }]} numberOfLines={1}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

interface HBarRowProps {
  label: string;
  value: number;
  max: number;
  /** Optional element drawn before the label (an icon). */
  leading?: React.ReactNode;
}

/** A labelled horizontal bar with its value at the end, for ranked breakdowns. */
export function HBarRow({ label, value, max, leading }: HBarRowProps) {
  const colors = Colors[useColorScheme()];
  return (
    <View style={styles.hRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.hLabel}>
        {leading}
        <Text style={{ color: colors.text, fontSize: 15 }} numberOfLines={1}>{label}</Text>
      </View>
      <View style={[styles.hTrack, { backgroundColor: colors.text + '12' }]}>
        {value > 0 && <View style={[styles.hFill, { backgroundColor: colors.tint, width: `${Math.max(3, (value / Math.max(1, max)) * 100)}%` }]} />}
      </View>
      <Text style={[styles.hValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, backgroundColor: 'transparent' },
  column: { flex: 1, height: '100%' },
  barSlot: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 2, backgroundColor: 'transparent' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  baseline: { height: 1, marginTop: 0 },
  labels: { flexDirection: 'row', gap: 2, marginTop: 6, backgroundColor: 'transparent' },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 11 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, backgroundColor: 'transparent' },
  hLabel: { width: 118, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
  hTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  hFill: { height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  hValue: { width: 28, textAlign: 'right', fontSize: 15, fontWeight: '600' },
});
