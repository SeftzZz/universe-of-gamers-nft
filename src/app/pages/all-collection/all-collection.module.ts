import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AllCollectionPageRoutingModule } from './all-collection-routing.module';
import { AllCollectionPage } from './all-collection.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AllCollectionPageRoutingModule,
  ],
  declarations: [AllCollectionPage]
})
export class AllCollectionPageModule {}
