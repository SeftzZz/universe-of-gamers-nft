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
    }
  }

  logout() {
    this.auth.logout();
  }
}