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
    path: 'registration',
    loadChildren: () =>
      import('./registration/registration.module').then(m => m.RegistrationPageModule)
  },
  {
    path: 'explorer',
    loadChildren: () =>
      import('./explorer/explorer.module').then(m => m.ExplorerPageModule)
  },
  {
    path: 'offline',
    loadChildren: () =>
      import('./pages/offline/offline.module').then(m => m.OfflinePageModule)
  },
  // ✅ Semua halaman setelah login lewat MarketLayout
  {
    path: 'market-layout',
    loadChildren: () =>
      import('./pages/market-layout/market-layout.module').then(m => m.MarketLayoutPageModule),
    canActivate: [AuthGuard]
  },
  // ✅ Default redirect
  {
    path: '',
    redirectTo: 'explorer',
    pathMatch: 'full'
  },
  // (Optional) 404 fallback
  {
    path: '**',
    redirectTo: 'explorer'
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
