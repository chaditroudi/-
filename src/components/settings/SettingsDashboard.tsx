import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings } from '@/hooks/useSettings';
import { BrandingPanel } from './branding/BrandingPanel';
import { FeaturesPanel } from './features/FeaturesPanel';
import { PlantInfoPanel } from './plant/PlantInfoPanel';
import { UserManagementPanel } from './users/UserManagementPanel';
import { OperationsPanel } from './operations/OperationsPanel';
import { QualityPanel } from './quality/QualityPanel';
import { DocumentsPanel } from './documents/DocumentsPanel';
import { NotificationsPanel } from './notifications/NotificationsPanel';
import { IntegrationsPanel } from './integrations/IntegrationsPanel';
import { P2PSettingsPanel } from './p2p/P2PSettingsPanel';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { Palette, ToggleLeft, Factory, Users, Settings2, ShieldCheck, FileText, BellRing, PlugZap, Receipt } from 'lucide-react';

export function SettingsDashboard() {
  const { data: settings = DEFAULT_SETTINGS, isLoading } = useSiteSettings();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Chargement des paramètres…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Préférences & Configuration</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Paramètres de marque, exploitation, qualité, documents, alertes et intégrations — {settings.company_name}
        </p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl">
          <TabsTrigger value="branding" className="shrink-0 gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Marque & Couleurs
          </TabsTrigger>
          <TabsTrigger value="features" className="shrink-0 gap-1.5">
            <ToggleLeft className="h-3.5 w-3.5" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="plant" className="shrink-0 gap-1.5">
            <Factory className="h-3.5 w-3.5" />
            Infos Usine
          </TabsTrigger>
          <TabsTrigger value="operations" className="shrink-0 gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Exploitation
          </TabsTrigger>
          <TabsTrigger value="quality" className="shrink-0 gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Qualité
          </TabsTrigger>
          <TabsTrigger value="documents" className="shrink-0 gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="notifications" className="shrink-0 gap-1.5">
            <BellRing className="h-3.5 w-3.5" />
            Alertes
          </TabsTrigger>
          <TabsTrigger value="p2p" className="shrink-0 gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Achats & P2P
          </TabsTrigger>
          <TabsTrigger value="integrations" className="shrink-0 gap-1.5">
            <PlugZap className="h-3.5 w-3.5" />
            Intégrations
          </TabsTrigger>
          <TabsTrigger value="users" className="shrink-0 gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Utilisateurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <BrandingPanel settings={settings} />
        </TabsContent>
        <TabsContent value="features" className="mt-4">
          <FeaturesPanel settings={settings} />
        </TabsContent>
        <TabsContent value="plant" className="mt-4">
          <PlantInfoPanel settings={settings} />
        </TabsContent>
        <TabsContent value="operations" className="mt-4">
          <OperationsPanel settings={settings} />
        </TabsContent>
        <TabsContent value="quality" className="mt-4">
          <QualityPanel settings={settings} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsPanel settings={settings} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsPanel settings={settings} />
        </TabsContent>
        <TabsContent value="p2p" className="mt-4">
          <P2PSettingsPanel settings={settings} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <IntegrationsPanel settings={settings} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UserManagementPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
