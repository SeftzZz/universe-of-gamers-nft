import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
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
    path: 'offline',
    loadChildren: () =>
      import('./pages/offline/offline.module').then(m => m.OfflinePageModule)
  },
  // ✅ Semua halaman setelah login lewat MarketLayout
  {
    path: 'market-layout',
    loadChildren: () =>
      import('./pages/market-layout/market-layout.module').then(m => m.MarketLayoutPageModule)
  },
  {
    path: 'auth/callback',
    loadChildren: () => import('./callback/callback.module').then( m => m.CallbackPageModule)
  },
  // ✅ Default redirect
  {
    path: '',
    redirectTo: 'market-layout',
    pathMatch: 'full'
  },
  // (Optional) 404 fallback
  {
    path: '**',
    redirectTo: 'market-layout'
  },

];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
