var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
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
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [
            GuardsModule,
            AuthModule,
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
], AppModule);
export { AppModule };
