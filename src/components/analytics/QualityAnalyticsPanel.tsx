import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Droplets,
  Shield,
  Award,
  TrendingUp
} from 'lucide-react';
import { useQualityAnalytics } from '@/hooks/useAnalytics';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar } from 'recharts';

interface QualityAnalyticsPanelProps {
  period: 'week' | 'month' | 'quarter';
}

export const QualityAnalyticsPanel = ({ period }: QualityAnalyticsPanelProps) => {
  const { data, isLoading } = useQualityAnalytics(period);

  if (isLoading) {
    return (
      <div className="grid gap-6 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-48 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = data?.stats;

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const passRateData = [
    { name: 'Conformité', value: stats?.passRate || 0, fill: 'hsl(var(--chart-3))' }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Inspections</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.passedInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Conformes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failedInspections || 0}</p>
                <p className="text-xs text-muted-foreground">Rejetées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(stats?.passRate || 0).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Taux conformité</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalNonConformities || 0}</p>
                <p className="text-xs text-muted-foreground">Non-conformités</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.criticalNonConformities || 0}</p>
                <p className="text-xs text-muted-foreground">NC Critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass Rate Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-500" />
              Taux de Conformité Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex flex-col items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <RadialBarChart 
                    cx="50%" 
                    cy="50%" 
                    innerRadius="60%" 
                    outerRadius="90%" 
                    data={passRateData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={10}
                      fill="hsl(var(--chart-3))"
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{(stats?.passRate || 0).toFixed(0)}%</span>
                  <span className="text-sm text-muted-foreground">Conformité</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats?.passedInspections || 0}</p>
                  <p className="text-xs text-muted-foreground">Acceptées</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{stats?.failedInspections || 0}</p>
                  <p className="text-xs text-muted-foreground">Rejetées</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Distribution par Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {data?.gradeDistribution && data.gradeDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.gradeDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="grade" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} lots (${data.gradeDistribution?.find(g => g.count === value)?.percentage.toFixed(1)}%)`,
                        ''
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {data.gradeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune donnée de grade disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quality Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Métriques Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Droplets className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">Humidité Moy. (%)</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <Target className="h-8 w-8 mx-auto text-purple-500 mb-2" />
              <p className="text-2xl font-bold">{stats?.totalInspections || 0}</p>
              <p className="text-xs text-muted-foreground">Total Inspections</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold">{stats?.totalNonConformities || 0}</p>
              <p className="text-xs text-muted-foreground">Non-conformités</p>
            </div>
            
            <div className="p-4 rounded-lg bg-red-50 text-center border border-red-100">
              <Shield className="h-8 w-8 mx-auto text-red-500 mb-2" />
              <p className="text-2xl font-bold text-red-600">{stats?.criticalNonConformities || 0}</p>
              <p className="text-xs text-red-600">NC Critiques</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
