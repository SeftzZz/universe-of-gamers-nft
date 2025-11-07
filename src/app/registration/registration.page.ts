import { Component, OnInit } from '@angular/core';
import { Auth } from '../services/auth';
import { ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { User } from '../services/user';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: false,
})
export class RegistrationPage implements OnInit {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptedTerms = false;
  referralCode = ''; // 🧩 Tambahan field referral
  showPassword = false;
  showPasswordConfirm = false;

  private loading: HTMLIonLoadingElement | null = null;

  constructor(
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router,
    private userService: User,
  ) {}

  ngOnInit() {}

  async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }

  async presentLoading(message = 'Please wait...') {
    this.loading = await this.loadingCtrl.create({
      message,
      spinner: 'crescent',
      translucent: true,
    });
    await this.loading.present();
  }

  async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  clearForm() {
    this.name = '';
    this.email = '';
    this.password = '';
    this.confirmPassword = '';
    this.acceptedTerms = false;
    this.referralCode = ''; // 🔄 reset juga referral code
  }

  togglePassword(field: 'password' | 'confirm') {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showPasswordConfirm = !this.showPasswordConfirm;
    }
  }

  async onRegister(event: Event) {
    event.preventDefault();

    if (this.password !== this.confirmPassword) {
      this.showToast('Passwords do not match!', 'danger');
      return;
    }

    if (!this.acceptedTerms) {
      this.showToast('Please accept the Terms and Privacy Policy', 'danger');
      return;
    }

    await this.presentLoading('Creating your account...');

    const payload = {
      name: this.name.trim(),
      email: this.email.trim(),
      password: this.password,
      acceptedTerms: this.acceptedTerms,
      referralCode: this.referralCode?.trim() || null, // 🧩 kirim ke backend
    };

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.dismissLoading();
        console.log('✅ Register success:', res);

        // ✅ simpan token + userId
        this.auth.setToken(res.token, res.authId);

        const avatarUrl = res.avatar
          ? `${environment.baseUrl}${res.avatar}`
          : 'assets/images/app-logo.jpeg';

        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
          role: res.role,
        });

        // ✅ ambil walletAddress (custodial dulu, kalau tidak ada pakai external)
        let walletAddr = null;
        if (res.custodialWallets?.length > 0) {
          walletAddr = res.custodialWallets[0].address;
        } else if (res.wallets?.length > 0) {
          walletAddr = res.wallets[0].address;
        }

        // ✅ simpan ke localStorage
        localStorage.setItem('userId', res.authId);
        if (walletAddr) localStorage.setItem('walletAddress', walletAddr);

        if (res.wallets || res.custodialWallets) {
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || []),
          ];
          localStorage.setItem('wallets', JSON.stringify(allWallets));
        }

        // 🧩 Jika referralCode dikirim, simpan flag lokal
        if (this.referralCode) {
          localStorage.setItem('usedReferral', 'true');
          console.log(`🎟️ Referral code ${this.referralCode} applied on register.`);
        }

        this.showToast('Register success 🎉', 'success');
        this.clearForm();

        // redirect ke halaman utama
        setTimeout(() => {
          window.location.href = '/market-layout/my-nfts';
        }, 500);
      },
      error: (err) => {
        this.dismissLoading();
        console.error('❌ Register failed:', err);
        this.showToast(err.error?.error || 'Register failed', 'danger');
      },
    });
  }

  onLogin() {
    this.presentLoading('Logging in...');

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.dismissLoading();
        console.log('✅ Login success:', res);
        this.auth.setToken(res.token, res.authId);
        this.showToast('Login success 🎉', 'success');
        this.clearForm();

        this.router.navigate(['/all-collection']);
      },
      error: (err) => {
        this.dismissLoading();
        console.error('❌ Login failed:', err);
        this.showToast(err.error?.error || 'Login failed', 'danger');
      },
    });
  }

  onGenerateCustodial() {
    this.presentLoading('Please wait...');
    const userId = this.auth.getAuthId();
    if (!userId) {
      this.dismissLoading();
      this.showToast('User not logged in', 'danger');
      return;
    }

    this.auth.generateCustodialWallet({ userId, provider: 'solana' }).subscribe({
      next: (res) => {
        this.dismissLoading();
        console.log('✅ Custodial wallet created:', res);
        this.showToast(`Wallet created: ${res.wallet.address}`, 'success');
      },
      error: (err) => {
        this.dismissLoading();
        console.error('❌ Custodial wallet error:', err);
        this.showToast(err.error?.error || 'Custodial wallet error', 'danger');
      },
    });
  }

  onLogout() {
    this.auth.logout();
    this.showToast('Logged out', 'success');
    this.clearForm();
    this.router.navigate(['/login']);
  }
}
