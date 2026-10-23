import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSyncStatus } from '@/store/syncStatus';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Settings block for syncing through a shared folder; only shown in the desktop app. */
export default function SyncSettings() {
  const colors = Colors[useColorScheme()];
  const { phase, folder, lastSyncAt, devices, summary, problems, error, syncNow } = useSyncStatus();
  if (phase === 'unavailable') return null;

  const api = window.mediaTrackerSync!;
  const choose = async () => {
    if (await api.chooseFolder()) syncNow();
  };
  const stop = async () => {
    await api.disable();
    syncNow();
  };

  const time = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : undefined;
  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, { backgroundColor: primary ? colors.tint : colors.cardBackground }]}
    >
      <Text style={{ color: primary ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.section, { marginTop: 30 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Sincronización</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }]}>
        {!folder ? (
          <>
            <Text style={{ color: colors.text + '99', fontSize: 14, lineHeight: 20 }}>
              Mantén tus datos iguales en varios equipos: elige una carpeta que ya se sincronice (iCloud Drive, Dropbox…) y usa la misma en cada Mac. Cada equipo guarda su propio archivo en ella.
            </Text>
            {button('Elegir carpeta…', choose, true)}
          </>
        ) : (
          <>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{folder}</Text>
            <Text style={{ color: error ? '#ff3b30' : colors.text + '99', fontSize: 14, marginTop: 6 }}>
              {phase === 'syncing'
                ? 'Sincronizando…'
                : error
                  ? error
                  : time
                    ? `Sincronizado a las ${time} · ${plural(devices ?? 1, 'dispositivo', 'dispositivos')}`
                    : 'Pendiente de la primera sincronización'}
            </Text>
            {summary && (summary.added > 0 || summary.updated > 0 || summary.removed > 0) && (
              <Text style={{ color: colors.text + '99', fontSize: 13, marginTop: 4 }}>
                Última fusión: {plural(summary.added, 'nuevo', 'nuevos')}, {plural(summary.updated, 'actualizado', 'actualizados')}, {plural(summary.removed, 'eliminado', 'eliminados')}.
              </Text>
            )}
            {problems.map((problem) => (
              <Text key={problem} style={{ color: '#ff9500', fontSize: 13, marginTop: 4 }}>{problem}</Text>
            ))}
            <View style={styles.buttons}>
              {button('Sincronizar ahora', syncNow, true)}
              {button('Cambiar carpeta…', choose)}
              {button('Dejar de sincronizar', stop)}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20 },
  title: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 10 },
  card: { borderRadius: 16, padding: 16 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, backgroundColor: 'transparent' },
  button: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 14 },
});
