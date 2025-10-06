import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements OnInit {
  metadata: any = null;
  history: any[] = [];

  constructor() { }

  ngOnInit() {
  }

  shortenAddress(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }
  
}
