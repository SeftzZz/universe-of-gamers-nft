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
  {
    path: 'all-collection',
    loadChildren: () =>
      import('./pages/all-collection/all-collection.module').then(m => m.AllCollectionPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'creates',
    loadChildren: () =>
      import('./pages/creates/creates.module').then(m => m.CreatesPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'my-favorite',
    loadChildren: () =>
      import('./pages/my-favorite/my-favorite.module').then(m => m.MyFavoritePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'wallet',
    loadChildren: () =>
      import('./pages/wallet/wallet.module').then(m => m.WalletPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'setting',
    loadChildren: () =>
      import('./pages/setting/setting.module').then(m => m.SettingPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'my-nfts',
    loadChildren: () =>
      import('./pages/my-nfts/my-nfts.module').then(m => m.MyNftsPageModule),
    canActivate: [AuthGuard]
  }
];


@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
