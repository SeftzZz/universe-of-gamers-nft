import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GatchaPageRoutingModule } from './gatcha-routing.module';

import { GatchaPage } from './gatcha.page';

import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GatchaPageRoutingModule,
    MarketLayoutPageModule
  ],
  declarations: [GatchaPage]
})
export class GatchaPageModule {}
