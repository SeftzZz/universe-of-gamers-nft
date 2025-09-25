import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth-guard';
import { LoginGuard } from './guards/login-guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () =>
      import('./login/login.module').then(m => m.LoginPageModule),
    canActivate: [LoginGuard]
  },
  {
    path: 'explorer',
    loadChildren: () => import('./explorer/explorer.module').then( m => m.ExplorerPageModule)
  },
  {
    path: '',
    redirectTo: 'explorer',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./pages/home/home.module').then((m) => m.HomePageModule),
    canActivate: [AuthGuard], // ✅ Proteksi home (semua child termasuk home)
  },
  {
    path: 'registration',
    loadChildren: () => import('./registration/registration.module').then( m => m.RegistrationPageModule)
  },
  {
    path: 'offline',
    loadChildren: () => import('./pages/offline/offline.module').then( m => m.OfflinePageModule)
  },
  {
    path: 'nft-detail/:mintAddress',
    loadChildren: () =>
      import('./pages/nft-detail/nft-detail.module').then((m) => m.NftDetailPageModule),
    canActivate: [AuthGuard], // ✅ Proteksi home (semua child termasuk home)
  },
  {
    path: 'market-layout',
    loadChildren: () => import('./pages/market-layout/market-layout.module').then( m => m.MarketLayoutPageModule)
  },
  {
    path: 'explorer',
    loadChildren: () => import('./pages/explorer/explorer.module').then( m => m.ExplorerPageModule)
  },
  {
    path: 'gatcha',
    loadChildren: () => 
      import('./pages/gatcha/gatcha.module').then( m => m.GatchaPageModule),
    canActivate: [AuthGuard],
  },

];


@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
