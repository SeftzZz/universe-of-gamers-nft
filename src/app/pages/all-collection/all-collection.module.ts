import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AllCollectionPageRoutingModule } from './all-collection-routing.module';
import { AllCollectionPage } from './all-collection.page';
import { MarketLayoutPageModule } from '../market-layout/market-layout.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AllCollectionPageRoutingModule,
    MarketLayoutPageModule // <== wajib ada supaya app-market-layout dikenali
  ],
  declarations: [AllCollectionPage]
})
export class AllCollectionPageModule {}
