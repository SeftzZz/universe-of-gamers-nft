import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SettingPageRoutingModule } from './setting-routing.module';
import { SettingPage } from './setting.page';
import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SettingPageRoutingModule,
    MarketLayoutPageModule // <== wajib ada supaya app-market-layout dikenali
  ],
  declarations: [SettingPage]
})
export class SettingPageModule {}
