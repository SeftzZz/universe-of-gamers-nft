import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NftDetailPage } from './nft-detail.page';

const routes: Routes = [
  {
    path: '',
    component: NftDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NftDetailPageRoutingModule {}
