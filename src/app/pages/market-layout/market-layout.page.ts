import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-market-layout',
  templateUrl: './market-layout.page.html',
  styleUrls: ['./market-layout.page.scss'],
  standalone: false,
})
export class MarketLayoutPage implements OnInit {
  userName: string = '';
  userAvatar: string = 'assets/images/avatar/avatar-small-01.png';

  userAddress: string | null = null;
  userRole: string | null = null; // ✅ tambahkan role
  constructor(
    private auth: Auth,
    private router: Router
  ) {}

  ngOnInit() {
    // Ambil data user dari localStorage
    const storedUser = localStorage.getItem('userProfile');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.userName = user.name;
      this.userAvatar = user.avatar || 'assets/images/avatar/avatar-small-01.png';
      this.userRole = user.role || null; // ✅ simpan role
    }

    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
    }
  }

  isAllCollectionActive(): boolean {
      return this.router.isActive('/all-collection', false) || this.router.url.startsWith('/nft-detail');
  }

  logout() {
    this.auth.logout();
  }
}