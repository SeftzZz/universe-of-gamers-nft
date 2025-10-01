import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CreatesPageRoutingModule } from './creates-routing.module';

import { CreatesPage } from './creates.page';

import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CreatesPageRoutingModule,
    MarketLayoutPageModule
  ],
  declarations: [CreatesPage]
})
export class CreatesPageModule {}
