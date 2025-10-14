import { Component, OnInit, OnDestroy } from '@angular/core';
import { Market } from 'src/app/services/market';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false,
})
export class TransactionsPage implements OnInit, OnDestroy {
  history: any[] = [];
  isLoading = true;
  private sub?: Subscription;

  constructor(private market: Market) {}

  async ngOnInit() {
    // 🌀 Step 1: Subscribe untuk listen perubahan real-time dari BehaviorSubject
    this.sub = this.market.getMyHistory().subscribe((data) => {
      console.log('Realtime my-history:', data);
      this.history = data || [];
    });

    // 🚀 Step 2: Load data dari server (akan otomatis trigger subscribe di atas)
    await this.loadMyHistory();
  }

  async loadMyHistory() {
    this.isLoading = true;
    try {
      const data = await this.market.loadMyHistory(); // <== panggil endpoint /nft/my-history
      console.log('✅ Loaded from API:', data);
      // Data akan otomatis masuk ke this.history lewat BehaviorSubject
    } catch (err) {
      console.error('❌ Error loadMyHistory:', err);
      this.history = [];
    } finally {
      this.isLoading = false;
    }
  }

  shortenAddress(addr?: string): string {
    if (!addr) return '-';
    return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  }

  ngOnDestroy() {
    // 🧹 Unsubscribe untuk mencegah memory leak
    this.sub?.unsubscribe();
  }
}
