import { Module } from "@nestjs/common";

import { BonReceptionAchatModule } from "../modules/bon-reception-achat/bon-reception-achat.module.js";
import { ExportModule } from "../modules/export/export.module.js";
import { BonExpeditionModule } from "../modules/bon-expedition/bon-expedition.module.js";
import { AnalyticsModule } from "../modules/analytics/analytics.module.js";
import { DocumentPrintsModule } from "../modules/document-prints/document-prints.module.js";
import { AuditModule } from "../modules/audit/audit.module.js";
import { AuthModule } from "../modules/auth/auth.module.js";
import { BatchesModule } from "../modules/batches/batches.module.js";
import { CollectionsModule } from "../modules/collections/collections.module.js";
import { HrModule } from "../modules/hr/hr.module.js";
import { MaterialReceptionsModule } from "../modules/material-receptions/material-receptions.module.js";
import { MaterialsModule } from "../modules/materials/materials.module.js";
import { QualityExtModule } from "../modules/quality-ext/quality-ext.module.js";
import { ReceptionsExtModule } from "../modules/receptions-ext/receptions-ext.module.js";
import { TransportMgmtModule } from "../modules/transport-mgmt/transport.module.js";
import { NotificationsModule } from "../modules/notifications/notifications.module.js";
import { PackagingModule } from "../modules/packaging/packaging.module.js";
import { Phase2Module } from "../modules/phase2/phase2.module.js";
import { FluxModule } from "../modules/flux/flux.module.js";
import { ProductionModule } from "../modules/production/production.module.js";
import { P2PModule } from "../modules/p2p/p2p.module.js";
import { PurchasingModule } from "../modules/purchasing/purchasing.module.js";
import { RealtimeModule } from "../modules/realtime/realtime.module.js";
import { ReceptionsModule } from "../modules/receptions/receptions.module.js";
import { RpcModule } from "../modules/rpc/rpc.module.js";
import { SettingsModule } from "../modules/settings/settings.module.js";
import { StockModule } from "../modules/stock/stock.module.js";
import { StorageModule } from "../modules/storage/storage.module.js";
import { SuppliersModule } from "../modules/suppliers/suppliers.module.js";
import { AppController } from "./app.controller.js";
import { GuardsModule } from "./guards.module.js";

@Module({
  imports: [
    GuardsModule,
    AuthModule,
    BonReceptionAchatModule,
    BonExpeditionModule,
    ExportModule,
    RealtimeModule,
    AnalyticsModule,
    CollectionsModule,
    NotificationsModule,
    Phase2Module,
    PackagingModule,
    P2PModule,
    PurchasingModule,
    ReceptionsModule,
    StorageModule,
    SuppliersModule,
    RpcModule,
    SettingsModule,
    AuditModule,
    MaterialsModule,
    StockModule,
    BatchesModule,
    FluxModule,
    ProductionModule,
    ReceptionsExtModule,
    MaterialReceptionsModule,
    HrModule,
    TransportMgmtModule,
    QualityExtModule,
    DocumentPrintsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
