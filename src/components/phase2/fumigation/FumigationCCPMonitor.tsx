import { useFumigationSensorReadings } from '@/hooks/useFumigation';
import { FumigationCycle, FUMIGATION_PROTOCOL_CONFIG } from '@/types/phase2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Activity, Thermometer, Droplets, ShieldAlert } from 'lucide-react';

interface Props {
  cycle: FumigationCycle;
}

export function FumigationCCPMonitor({ cycle }: Props) {
  const { data: readings = [], isLoading } = useFumigationSensorReadings(cycle.id);
  const proto = FUMIGATION_PROTOCOL_CONFIG[cycle.protocol];

  const chartData = readings.slice(-60).map((r) => ({
    time: format(new Date(r.read_at), 'HH:mm', { locale: fr }),
    conc: r.concentration_avg_gm3,
    tempAvg: r.temperature_t1_c != null && r.temperature_t2_c != null
      ? Math.round(((r.temperature_t1_c + r.temperature_t2_c) / 2) * 10) / 10
      : null,
    humidity: r.humidity_h1_percent,
    leak: r.external_leak_ppm,
  }));

  const latest = readings[readings.length - 1];
  const durationMs = cycle.t0_start ? Date.now() - new Date(cycle.t0_start).getTime() : 0;
  const durationHours = Math.floor(durationMs / 3_600_000);
  const durationMinutes = Math.floor((durationMs % 3_600_000) / 60_000);
  const progressPct = cycle.minimum_duration_minutes > 0
    ? Math.min(100, Math.round((durationMs / 60_000) / cycle.minimum_duration_minutes * 100))
    : 0;

  const leakWarning = latest?.external_leak_ppm != null && latest.external_leak_ppm > 0.3;
  const doorOpen = latest ? !latest.door_locked : false;

  return (
    <div className="space-y-4">
      {/* Safety alerts */}
      {leakWarning && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-2 text-red-800">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-semibold text-sm">FUITE EXTERNE DÉTECTÉE — {latest?.external_leak_ppm} ppm &gt; 0.3 ppm seuil. Évacuation immédiate.</span>
        </div>
      )}
      {doorOpen && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-center gap-2 text-red-800">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-semibold text-sm">PORTE NON VERROUILLÉE — Sécuriser immédiatement la chambre.</span>
        </div>
      )}

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Avancement CCP — {cycle.cycle_number}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>T0: {cycle.t0_start ? format(new Date(cycle.t0_start), 'dd/MM HH:mm') : '—'}</span>
                <span>{progressPct}% — {durationHours}h {durationMinutes}min / {proto.min_duration_h}h min</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <Badge variant={progressPct >= 100 ? 'default' : 'secondary'} className="shrink-0">
              {progressPct >= 100 ? 'Durée OK' : `${100 - progressPct}% restant`}
            </Badge>
          </div>

          {/* Current readings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <div className="text-xl font-bold">{latest?.concentration_avg_gm3 ?? '—'}</div>
              <div className="text-xs text-muted-foreground">Conc. moy. (g/m³)</div>
              <div className="text-xs text-muted-foreground">Cible: {proto.target_concentration}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <Thermometer className="h-4 w-4 mx-auto text-orange-500 mb-1" />
              <div className="text-xl font-bold">
                {latest?.temperature_t1_c != null ? `${latest.temperature_t1_c}°C` : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Temp T1</div>
              <div className="text-xs text-muted-foreground">Cible: {proto.target_temperature}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <Droplets className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-xl font-bold">
                {latest?.humidity_h1_percent != null ? `${latest.humidity_h1_percent}%` : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Humidité H1</div>
            </div>
            <div className={`rounded-lg p-3 text-center ${leakWarning ? 'bg-red-50' : 'bg-muted/40'}`}>
              <ShieldAlert className={`h-4 w-4 mx-auto mb-1 ${leakWarning ? 'text-red-500' : 'text-muted-foreground'}`} />
              <div className={`text-xl font-bold ${leakWarning ? 'text-red-700' : ''}`}>
                {latest?.external_leak_ppm != null ? `${latest.external_leak_ppm} ppm` : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Fuite externe</div>
              <div className="text-xs text-muted-foreground">Seuil: 0.3 ppm</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Concentration chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concentration CCP (dernières {chartData.length} lectures)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(v: number) => [`${v} g/m³`, 'Conc. moy.']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="conc"
                  name="Concentration (g/m³)"
                  stroke="#22c55e"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="tempAvg"
                  name="Temp. moy. (°C)"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={1.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="text-center text-sm text-muted-foreground py-4">Chargement des lectures capteurs…</div>
      )}
      {!isLoading && readings.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-4">Aucune lecture capteur enregistrée pour ce cycle.</div>
      )}
    </div>
  );
}
