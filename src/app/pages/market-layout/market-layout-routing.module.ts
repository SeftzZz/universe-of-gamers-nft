import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MarketLayoutPage } from './market-layout.page';
import { AuthGuard } from 'src/app/guards/auth-guard';

const routes: Routes = [
  {
    path: '',
    component: MarketLayoutPage,
    children: [
      {
        path: '',
        redirectTo: 'all-collection',
        pathMatch: 'full'
      },
      // 🟢 Tidak pakai AuthGuard
      {
        path: 'all-collection',
        loadChildren: () =>
          import('../all-collection/all-collection.module').then(m => m.AllCollectionPageModule)
      },
      // 🔒 Semua route di bawah ini tetap pakai AuthGuard
      {
        path: 'gatcha',
        canActivate: [AuthGuard],
        loadChildren: () => 
          import('../gatcha/gatcha.module').then(m => m.GatchaPageModule)
      },
      {
        path: 'creates',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../creates/creates.module').then(m => m.CreatesPageModule)
      },
      {
        path: 'my-favorite',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../my-favorite/my-favorite.module').then(m => m.MyFavoritePageModule)
      },
      {
        path: 'wallet',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../wallet/wallet.module').then(m => m.WalletPageModule)
      },
      {
        path: 'setting',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../setting/setting.module').then(m => m.SettingPageModule)
      },
      {
        path: 'my-nfts',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../my-nfts/my-nfts.module').then(m => m.MyNftsPageModule)
      },
      {
        path: 'nft-detail/:mintAddress',
        canActivate: [AuthGuard],
        loadChildren: () =>
          import('../nft-detail/nft-detail.module').then(m => m.NftDetailPageModule)
      },
      {
        path: 'transactions',
        canActivate: [AuthGuard],
        loadChildren: () => 
          import('../transactions/transactions.module').then(m => m.TransactionsPageModule)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarketLayoutPageRoutingModule {}
