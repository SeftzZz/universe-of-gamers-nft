import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NftDetailPageRoutingModule } from './nft-detail-routing.module';

import { NftDetailPage } from './nft-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NftDetailPageRoutingModule,
  ],
  declarations: [NftDetailPage],
  schemas: [
    CUSTOM_ELEMENTS_SCHEMA // Add the CUSTOM_ELEMENTS_SCHEMA here
  ]
})
export class NftDetailPageModule {}
