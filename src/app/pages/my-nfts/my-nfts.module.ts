import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MyNftsPageRoutingModule } from './my-nfts-routing.module';

import { MyNftsPage } from './my-nfts.page';

import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyNftsPageRoutingModule,
    MarketLayoutPageModule
  ],
  declarations: [MyNftsPage]
})
export class MyNftsPageModule {}
