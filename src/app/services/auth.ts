// src/app/services/auth.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class Auth {

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController   // inject ToastController
  ) {}

  // === Register Local ===
  register(data: { name: string; email: string; password: string; acceptedTerms: boolean }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/register`, data);
  }

  // === Login Local ===
  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/login`, data);
  }

  // === Login with Google ===
  loginWithGoogle(data: { googleId: string; email: string; name: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/google`, data);
  }

  // === Login / Import External Wallet ===
  loginWithWallet(data: { 
    provider: string; 
    address: string; 
    name?: string; 
    signature: string; 
    nonce: string; 
  }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/wallet`, data);
  }

  // === Generate Custodial Wallet ===
  generateCustodialWallet(data: { userId: string; provider: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/custodial`, data);
  }

  // === Contoh endpoint protected (pakai interceptor) ===
  getProfile(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/profile`);
  }

  // === Token Management ===
  setToken(token: string, userId: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('authId', userId);
    localStorage.setItem('userId', userId);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getAuthId(): string | null {
    return localStorage.getItem('authId');
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    const loggedIn = !!token;
    console.log('🔑 isLoggedIn() →', loggedIn, '| token =', token ? 'ada' : 'null');
    return loggedIn;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('authId');
    localStorage.removeItem('userId');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('walletTokens');
    localStorage.removeItem('wallets');

    // tampilkan toast
    this.toastCtrl.create({
      message: 'Logout Success',
      duration: 5000,
      color: 'success',
      position: 'top'
    }).then(toast => {
      toast.present();
    });

    // redirect setelah 10 detik
    setTimeout(() => {
      this.router.navigateByUrl('/explorer', { replaceUrl: true });
    }, 10000);
  }
}
