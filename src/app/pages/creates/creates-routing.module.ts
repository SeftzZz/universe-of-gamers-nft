import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CreatesPage } from './creates.page';

const routes: Routes = [
  {
    path: '',
    component: CreatesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CreatesPageRoutingModule {}
