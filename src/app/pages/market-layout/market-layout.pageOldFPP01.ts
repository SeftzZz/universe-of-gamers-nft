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
<<<<<<< HEAD
    private auth: Auth,   //inject Auth service
=======
    private auth: Auth,
>>>>>>> 040fe826f61d1ad1ee603ecdd275aae64bb0414d
  ) { }

  ngOnInit() {
  }

  logout() {
    this.auth.logout();
  }
}
