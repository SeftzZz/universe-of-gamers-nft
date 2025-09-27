import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AllCollectionPage } from './all-collection.page';

const routes: Routes = [
  {
    path: '',
    component: AllCollectionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AllCollectionPageRoutingModule {}
