import { View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { DateFieldProps } from './DateField';

/** Date and time pickers for the web / Electron build, using the browser's native controls. */
export default function DateField({ date, time, onChange }: DateFieldProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const style = {
    color: colors.text,
    background: 'transparent',
    border: `1px solid ${colors.text}40`,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: 'inherit',
    colorScheme: scheme,
    minWidth: 0,
  } as const;

  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: 'transparent' }}>
      <input
        type="date"
        aria-label="Fecha"
        value={date}
        onChange={(e) => onChange({ date: e.target.value, time })}
        style={{ ...style, flex: 2 }}
      />
      <input
        type="time"
        aria-label="Hora"
        value={time}
        onChange={(e) => onChange({ date, time: e.target.value })}
        style={{ ...style, flex: 1 }}
      />
    </View>
  );
}
