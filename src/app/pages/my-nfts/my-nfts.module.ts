import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MyNftsPageRoutingModule } from './my-nfts-routing.module';

import { MyNftsPage } from './my-nfts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MyNftsPageRoutingModule,
  ],
  declarations: [MyNftsPage]
})
export class MyNftsPageModule {}
