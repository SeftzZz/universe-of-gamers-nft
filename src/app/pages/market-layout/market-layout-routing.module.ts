import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MarketLayoutPage } from './market-layout.page';

const routes: Routes = [
  {
    path: '',
    component: MarketLayoutPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MarketLayoutPageRoutingModule {}
