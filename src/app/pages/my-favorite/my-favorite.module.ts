import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MyFavoritePageRoutingModule } from './my-favorite-routing.module';
import { MyFavoritePage } from './my-favorite.page';
// Import module MarketLayout
import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyFavoritePageRoutingModule,
    MarketLayoutPageModule   // <== wajib ada supaya app-market-layout dikenali
  ],
  declarations: [MyFavoritePage]
})
export class MyFavoritePageModule {}
