import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CreatesPageRoutingModule } from './creates-routing.module';

import { CreatesPage } from './creates.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CreatesPageRoutingModule,
  ],
  declarations: [CreatesPage]
})
export class CreatesPageModule {}
