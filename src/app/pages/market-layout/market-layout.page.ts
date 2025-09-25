import { Component, OnInit } from '@angular/core';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-market-layout',
  templateUrl: './market-layout.page.html',
  styleUrls: ['./market-layout.page.scss'],
  standalone: false,
})
export class MarketLayoutPage implements OnInit {

  constructor(
    private auth: Auth,
  ) { }

  ngOnInit() {
  }

  logout() {
    this.auth.logout();
  }
}
