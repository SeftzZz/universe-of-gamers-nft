import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';
import { MarketLayoutPage } from '../market-layout/market-layout.page';

interface INftItem {
    _id: string;
    name: string;
    description: string;
    image: string;
    owner: string;
    character?: string;
    rune?: string;
    [key: string]: any;
}

@Component({
    selector: 'app-my-favorite',
    templateUrl: './my-favorite.page.html',
    styleUrls: ['./my-favorite.page.scss'],
    standalone: false,
})
export class MyFavoritePage implements OnInit {
    nftFromDB: any[] = []; // daftar NFT dari DB
    runesFromDB: any[] = [];   // daftar RUNES dari DB
    latestNfts: any[] = [];
    runeMap: Record<string, any[]> = {};
    runes: any[] = [];
    nftCharacter: any[] = [];
    nftRune: any[] = [];
    favorites: Set<string> = new Set();

    constructor(
      private http: HttpClient,
      private auth: Auth,   //inject Auth service
      private router: Router
    ) {}

    async ngOnInit() {
        await this.loadFavorites();
        await this.loadNft();
        await this.loadNftDB();
        await this.loadRunes();
        await this.setLatestNfts();
    }

    loadFavorites() {
        const stored = localStorage.getItem('favorites');
        if (stored) {
          this.favorites = new Set(JSON.parse(stored));
        }
    }

    shorten(addr: string) {
      return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    async loadNft() {
      try {
        const data: any = await this.http
          .get(`${environment.apiUrl}/nft/fetch-nft`)
          .toPromise();

        // Ambil NFT favorit saja
        this.nftCharacter = data.filter(
          (item: INftItem) =>
            !!item.character &&
            this.favorites.has(`favNft:${item._id}`)
        );

        // Ambil NFT Rune favorit saja
        this.nftRune = data.filter(
          (item: INftItem) =>
            !!item.rune &&
            this.favorites.has(`favRune:${item._id}`)
        );

        // console.log('Favorit NFT:', this.nftCharacter);
        // console.log('Favorit NFT Rune:', this.nftRune);
      } catch (err) {
        console.error('Error loading NFT:', err);
        this.nftFromDB = [];
        this.nftCharacter = [];
        this.nftRune = [];
      }
    }

    async loadNftDB() {
        try {
          const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-nftDB`).toPromise();
          this.nftFromDB = data;
          console.log('NFT List From DB:', this.nftFromDB);
        } catch (err) {
          console.error('Error loading NFT:', err);
        }
    }

    async loadRunes() {
        try {
            const data = await firstValueFrom(
              this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
            );

            // Ambil RUNES dari DB
            this.runesFromDB = data;
            // console.log("RUNES List From DB:", this.runesFromDB);

            // Hanya rune favorit
            this.runes = data.filter((r: any) =>
              this.favorites.has(`favRune:${r._id}`)
            );

            // console.log("Favorit Runes:", this.runes);

            this.runeMap = this.runes.reduce((acc: Record<string, any[]>, r: any) => {
              acc[r.rarity] = [...(acc[r.rarity] || []), r];
              return acc;
            }, {} as Record<string, any[]>);
        } catch (err) {
            console.error("Error loading runes:", err);
            this.runes = [];
            this.runeMap = {};
        }
    }

    formatWithZeroCount(num: number): string {
        const str = num.toString();

        if (!str.includes(".")) return `$${str}`;

        const [intPart, decPart] = str.split(".");

        // cari jumlah nol berturut-turut setelah "0."
        let zeroCount = 0;
        for (const ch of decPart) {
          if (ch === "0") zeroCount++;
          else break;
        }

        // ambil sisa digit setelah nol
        const rest = decPart.slice(zeroCount);

        // map angka ke subscript unicode
        const subscripts: Record<string, string> = {
          "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
          "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"
        };

        const zeroCountStr = zeroCount.toString()
          .split("")
          .map((d) => subscripts[d] || d)
          .join("");

        const result = `${intPart}.0${zeroCountStr}${rest} SOL`;

        // console.log(`formatWithZeroCount(${num}) => ${result}`);
        return result;
    }

    goToNftDetail(mintAddress: string) {
      if (!mintAddress) return;
      console.log("Navigating to NFT detail:", mintAddress);
      this.router.navigate(['/nft-detail', mintAddress]);
    }

    isOpen = false;
    selected = '';
    activeTab: 'character' | 'rune' = 'character';

    // pagination more item
    itemsToShowCharacter = 8;
    itemsToShowRune = 8;
    loadStep = 8;

    toggleDropdown() {
      this.isOpen = !this.isOpen;
    }

    switchTab(tab: 'character' | 'rune') {
      this.activeTab = tab;
      this.isOpen = false; // tutup dropdown saat ganti tab
    }

    sortData(type: string) {
      let target = this.activeTab === 'character' ? this.nftCharacter : this.nftRune;

      if (type === 'recent') {
        target.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.selected = 'Recently added';
      } else if (type === 'low') {
        target.sort((a, b) => a.price - b.price);
        this.selected = 'Price: Low to High';
      } else if (type === 'high') {
        target.sort((a, b) => b.price - a.price);
        this.selected = 'Price: High to Low';
      }

      this.isOpen = false; // otomatis tutup dropdown setelah pilih
    }

    loadMoreCharacter() {
      this.itemsToShowCharacter += this.loadStep;
    }

    loadMoreRune() {
      this.itemsToShowRune += this.loadStep;
    }

    async setLatestNfts() {
      // gabungkan semua NFT & Rune
      const allNft = [...this.nftFromDB, ...this.runesFromDB];

      if (allNft.length > 0) {
        // urutkan dari terbaru
        this.latestNfts = allNft
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 4); // ambil 4 terbaru
      }
    }

    logout() {
      this.auth.logout();
    }
}