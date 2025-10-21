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
  filteredHistory: any[] = [];
  isLoading = true;
  private sub?: Subscription;
  userAddress: string | null = null;

  // Koleksi NFT untuk filter karakter dan rune
  nftBC: any[] = [];
  nftRuneBC: any[] = [];
  fetchnft: any[] = [];

  constructor(private market: Market) {}

  async ngOnInit() {
    await this.refreshAll();
  }

  async ionViewWillEnter() {
    await this.refreshAll();
  }
  
  async refreshAll() {
    // 🧩 Ambil wallet aktif dari localStorage
    this.userAddress = localStorage.getItem('walletAddress')?.replace(/"/g, '') || null;
    console.log('👛 Active wallet detected:', this.userAddress);

    // 🌀 Listen perubahan dari BehaviorSubject myHistory
    this.sub = this.market.getMyHistory().subscribe((data) => {
      console.log('📜 Realtime my-history update:', data);
      this.history = data || [];
      this.applyWalletFilter();
    });

    // 🚀 Load data awal
    await this.loadMyHistory();
  }

  /**
   * 🔄 Load my-history dari server dan filter langsung
   */
  async loadMyHistory() {
    this.isLoading = true;

    try {
      const wallet = localStorage.getItem('walletAddress')?.replace(/"/g, '') || '';
      const queryParam = wallet ? `?wallet=${wallet}` : '';
      console.log(`🚀 Fetching /nft/my-history${queryParam}`);

      // panggil API dengan wallet param
      const data = await this.market.loadMyHistoryWithWallet(wallet);

      console.log(`✅ Loaded ${data?.length || 0} entries for wallet: ${wallet}`);
      this.fetchnft = data || [];
      this.applyWalletFilter();
      this.filterNftsBywalletAddress();
    } catch (err) {
      console.error('❌ Error loadMyHistory:', err);
      this.history = [];
      this.filteredHistory = [];
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔍 Filter transaksi berdasarkan wallet aktif
   */
  private applyWalletFilter() {
    if (!this.userAddress) {
      console.warn('⚠️ No active wallet found. Showing empty result.');
      this.filteredHistory = [];
      return;
    }

    const walletAddr = this.userAddress.toLowerCase();
    this.filteredHistory = this.history.filter(
      (tx) => tx.wallet?.toLowerCase() === walletAddr
    );

    console.log(
      `✅ Filtered ${this.filteredHistory.length}/${this.history.length} transactions for ${walletAddr}`
    );
  }

  /**
   * 🔎 Filter NFT Character dan Rune
   */
  private filterNftsBywalletAddress() {
    console.log('🔍 [filterNftsBywalletAddress] Called');
    console.log('   🧩 userAddress:', this.userAddress);
    console.log('   🧮 Total fetched NFT:', this.fetchnft?.length || 0);

    if (!this.userAddress) {
      console.warn('⚠️ No active wallet found. Clearing NFT lists.');
      this.nftBC = [];
      this.nftRuneBC = [];
      return;
    }

    const walletAddr = this.userAddress.toLowerCase();

    this.nftBC = this.fetchnft.filter(
      (n) => n.character && n.owner?.toLowerCase() === walletAddr
    );
    this.nftRuneBC = this.fetchnft.filter(
      (n) => n.rune && n.owner?.toLowerCase() === walletAddr
    );

    console.log('✅ [filterNftsBywalletAddress] Done filtering:');
    console.log('   🎭 Characters:', this.nftBC.length);
    console.log('   🔮 Runes:', this.nftRuneBC.length);

    if (this.nftBC.length > 0)
      console.log('   🔹 Example Character NFT:', this.nftBC[0]);
    if (this.nftRuneBC.length > 0)
      console.log('   🔹 Example Rune NFT:', this.nftRuneBC[0]);
  }

  shortenAddress(addr?: string): string {
    if (!addr) return '-';
    return addr.length > 10 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
