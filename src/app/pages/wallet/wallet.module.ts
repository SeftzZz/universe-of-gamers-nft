import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { WalletPageRoutingModule } from './wallet-routing.module';
import { WalletPage } from './wallet.page';
import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        WalletPageRoutingModule,
        MarketLayoutPageModule // <== wajib ada supaya app-market-layout dikenali
    ],
    declarations: [WalletPage]
})
export class WalletPageModule {}
