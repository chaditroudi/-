import { ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CAPAPanel } from './CAPAPanel';
import { AuditTrailPanel } from './AuditTrailPanel';

type Props = {
  currentUser: string;
};

export const QualityDashboard = ({ currentUser }: Props) => {
  return (
    <div className="space-y-4">

      <Tabs defaultValue="capa" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="capa">CAPA</TabsTrigger>
          <TabsTrigger value="audit">Journal d'audit</TabsTrigger>
        </TabsList>

        <TabsContent value="capa">
          <CAPAPanel currentUser={currentUser} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditTrailPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
