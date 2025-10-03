import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MyNftsPage } from './my-nfts.page';

const routes: Routes = [
  {
    path: '',
    component: MyNftsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MyNftsPageRoutingModule {}
