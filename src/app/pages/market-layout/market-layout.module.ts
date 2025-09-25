import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MarketLayoutPageRoutingModule } from './market-layout-routing.module';

import { MarketLayoutPage } from './market-layout.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MarketLayoutPageRoutingModule
  ],
  declarations: [MarketLayoutPage],
  exports: [MarketLayoutPage]
})
export class MarketLayoutPageModule {}
