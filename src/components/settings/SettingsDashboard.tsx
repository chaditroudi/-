import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSiteSettings } from '@/hooks/useSettings';
import { BrandingPanel } from './branding/BrandingPanel';
import { FeaturesPanel } from './features/FeaturesPanel';
import { PlantInfoPanel } from './plant/PlantInfoPanel';
import { UserManagementPanel } from './users/UserManagementPanel';
import { SignaturePinSelfPanel } from './users/SignaturePinSelfPanel';
import { OperationsPanel } from './operations/OperationsPanel';
import { QualityPanel } from './quality/QualityPanel';
import { DocumentsPanel } from './documents/DocumentsPanel';
import { NotificationsPanel } from './notifications/NotificationsPanel';
import { IntegrationsPanel } from './integrations/IntegrationsPanel';
import { P2PSettingsPanel } from './p2p/P2PSettingsPanel';
import { CostingPanel } from './costing/CostingPanel';
import { ProductAboutPanel } from './ProductAboutPanel';
import { TrustGatesPanel } from './TrustGatesPanel';
import { FichesCmsPanel } from './FichesCmsPanel';
import { DEFAULT_SETTINGS } from '@/types/settings';
import type { AppNavigateFn } from '@/lib/appNavigate';
import { PRODUCT } from '@/lib/productMeta';
import {
  Palette,
  ToggleLeft,
  Factory,
  Users,
  Settings2,
  ShieldCheck,
  FileText,
  BellRing,
  PlugZap,
  Receipt,
  Coins,
  Info,
  BookOpen,
} from 'lucide-react';

export function SettingsDashboard({ onNavigate }: { onNavigate?: AppNavigateFn } = {}) {
  const { data: settings = DEFAULT_SETTINGS, isLoading } = useSiteSettings();

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Chargement des paramètres…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="plant">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="fiches" className="shrink-0 gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Fiches
          </TabsTrigger>
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
          <TabsTrigger value="costing" className="shrink-0 gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            Coûts
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
          <TabsTrigger value="product" className="shrink-0 gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Produit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="mt-4 space-y-4">
          <ProductAboutPanel
            onOpenFiches={onNavigate ? () => onNavigate('home', { view: 'fiches' }) : undefined}
          />
          <TrustGatesPanel />
        </TabsContent>
        <TabsContent value="fiches" className="mt-4">
          <FichesCmsPanel settings={settings} />
        </TabsContent>
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
        <TabsContent value="costing" className="mt-4">
          <CostingPanel settings={settings} />
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
        <TabsContent value="users" className="mt-4 space-y-4">
          <SignaturePinSelfPanel />
          <UserManagementPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
