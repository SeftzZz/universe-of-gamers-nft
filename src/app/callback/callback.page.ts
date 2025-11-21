import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-callback',
  template: `<ion-content>
               <div style="padding:20px; text-align:center;">
                 <ion-spinner></ion-spinner>
                 <p>Signing you in...</p>
               </div>
             </ion-content>`,
  standalone: false,
})
export class CallbackPage implements OnInit {

  constructor(
    private router: Router,
    private auth: Auth
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const hash = window.location.hash;

      if (!hash.includes('id_token=')) {
        console.error("Callback: No id_token found");
        await this.router.navigate(['/login'], {
          queryParams: { error: 'missing_token' }
        });
        return;
      }

      const params = new URLSearchParams(hash.replace('#', '?'));
      const idToken = params.get('id_token');

      if (!idToken) {
        await this.router.navigate(['/login'], {
          queryParams: { error: 'no_token' }
        });
        return;
      }

      const payload = JSON.parse(atob(idToken.split('.')[1]));
      console.log("OAuth payload:", payload);

      const resp = await this.auth.finishOAuthLogin(payload, idToken);
      console.log("OAuth login success:", resp);

      // SUCCESS → kembali ke halaman login
      await this.router.navigate(['/login'], {
        queryParams: { from: 'google-login', oauth: 'success' },
        replaceUrl: true,
      });

      return;

    } catch (err) {
      console.error("❌ OAuth callback error:", err);

      await this.router.navigate(['/login'], {
        queryParams: { from: 'google-login', oauth: 'failed' },
      });

      return;
    }
  }
}
