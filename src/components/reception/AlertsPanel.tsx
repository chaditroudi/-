import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Bell, AlertTriangle, Clock, XCircle, CheckCircle, 
  Eye, Shield, Truck, Calendar 
} from 'lucide-react';
import { useAcknowledgeReceptionAlert, useReceptionAlerts, useResolveReceptionAlert } from '@/hooks/useReceptionsV2';
import { ReceptionAlert, severityColors, severityLabels, CheckSeverity } from '@/types/reception';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const alertTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  QUARANTINE_DURATION: Clock,
  PENDING_QC: Clock,
  SUPPLIER_REJECTION_RATE: Truck,
  BLOCKED_PRODUCTION: Shield,
  EXPIRY_WARNING: Calendar
};

const alertTypeLabels: Record<string, string> = {
  QUARANTINE_DURATION: 'Durée quarantaine',
  PENDING_QC: 'QC en attente',
  SUPPLIER_REJECTION_RATE: 'Taux de rejet fournisseur',
  BLOCKED_PRODUCTION: 'Production bloquée',
  EXPIRY_WARNING: 'Expiration proche'
};

export const AlertsPanel = () => {
  const { data: alerts = [], isLoading } = useReceptionAlerts();
  const acknowledgeAlert = useAcknowledgeReceptionAlert();
  const resolveAlert = useResolveReceptionAlert();
  const [selectedAlert, setSelectedAlert] = useState<ReceptionAlert | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [acknowledgedBy, setAcknowledgedBy] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAcknowledge = async () => {
    if (!selectedAlert || !acknowledgedBy) return;
    
    setIsProcessing(true);
    try {
      await acknowledgeAlert.mutateAsync({
        alertId: selectedAlert.id,
        actorName: acknowledgedBy,
      });
      toast.success('Alerte acquittée');
      setActionDialogOpen(false);
      setSelectedAlert(null);
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error('Erreur lors de l\'acquittement');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedAlert || !acknowledgedBy) return;
    
    setIsProcessing(true);
    try {
      await resolveAlert.mutateAsync({
        alertId: selectedAlert.id,
        actorName: acknowledgedBy,
      });
      toast.success('Alerte résolue');
      setActionDialogOpen(false);
      setSelectedAlert(null);
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Erreur lors de la résolution');
    } finally {
      setIsProcessing(false);
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'CRITIQUE').length;
  const majorCount = alerts.filter(a => a.severity === 'MAJEUR').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertes Actives
            {alerts.length > 0 && (
              <Badge variant="destructive">{alerts.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge className="bg-red-600">{criticalCount} critique(s)</Badge>
            )}
            {majorCount > 0 && (
              <Badge className="bg-orange-500">{majorCount} majeur(s)</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <p className="text-muted-foreground">Aucune alerte active</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const Icon = alertTypeIcons[alert.alert_type] || AlertTriangle;
                
                return (
                  <Card 
                    key={alert.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      alert.severity === 'CRITIQUE' ? 'border-red-300 bg-red-50' :
                      alert.severity === 'MAJEUR' ? 'border-orange-300 bg-orange-50' :
                      'border-yellow-300 bg-yellow-50'
                    }`}
                    onClick={() => {
                      setSelectedAlert(alert);
                      setActionDialogOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          alert.severity === 'CRITIQUE' ? 'bg-red-200' :
                          alert.severity === 'MAJEUR' ? 'bg-orange-200' :
                          'bg-yellow-200'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            alert.severity === 'CRITIQUE' ? 'text-red-700' :
                            alert.severity === 'MAJEUR' ? 'text-orange-700' :
                            'text-yellow-700'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-sm">{alert.title}</h4>
                            <Badge className={severityColors[alert.severity as CheckSeverity]} variant="secondary">
                              {severityLabels[alert.severity as CheckSeverity]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{alertTypeLabels[alert.alert_type] || alert.alert_type}</span>
                            <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}</span>
                          </div>
                          {alert.threshold_value && alert.current_value && (
                            <div className="mt-2 text-xs">
                              <span className="text-muted-foreground">Seuil: {alert.threshold_value}</span>
                              <span className="mx-2">|</span>
                              <span className="font-medium text-red-600">Actuel: {alert.current_value}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Alert Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gérer l'alerte</DialogTitle>
            </DialogHeader>

            {selectedAlert && (
              <div className="space-y-4">
                <Card className={`${
                  selectedAlert.severity === 'CRITIQUE' ? 'bg-red-50 border-red-200' :
                  selectedAlert.severity === 'MAJEUR' ? 'bg-orange-50 border-orange-200' :
                  'bg-yellow-50 border-yellow-200'
                }`}>
                  <CardContent className="p-4">
                    <h4 className="font-semibold">{selectedAlert.title}</h4>
                    <p className="text-sm mt-1">{selectedAlert.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Créée le {format(new Date(selectedAlert.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>Votre nom *</Label>
                  <Input 
                    value={acknowledgedBy}
                    onChange={(e) => setAcknowledgedBy(e.target.value)}
                    placeholder="Nom du responsable"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                Fermer
              </Button>
              <Button 
                variant="secondary"
                onClick={handleAcknowledge}
                disabled={!acknowledgedBy || isProcessing}
              >
                <Eye className="h-4 w-4 mr-1" />
                Acquitter
              </Button>
              <Button 
                onClick={handleResolve}
                disabled={!acknowledgedBy || isProcessing}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Résoudre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
