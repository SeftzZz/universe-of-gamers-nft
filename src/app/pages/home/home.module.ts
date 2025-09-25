import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';
import { NftService } from '../../services/nft.service';

import { HomePageRoutingModule } from './home-routing.module';

import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    MarketLayoutPageModule
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
