import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
    selector: 'app-wallet',
    templateUrl: './wallet.page.html',
    styleUrls: ['./wallet.page.scss'],
    standalone: false,
})
export class WalletPage implements OnInit {

    nftDB: any[] = []; // daftar NFT dari DB
    runesDB: any[] = [];   // list rune dari DB
    runeMap: Record<string, any[]> = {};
    latestNfts: any[] = [];

    constructor(
        private http: HttpClient,
        private auth: Auth,   //inject Auth service
        private router: Router
    ) {}

    async ngOnInit() {
        await this.loadNftDB();
        await this.loadRunesDB();
        await this.setLatestNfts();
    }

    shorten(addr: string) {
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    async loadNftDB() {
        try {
            const data: any = await this.http.get(`${environment.apiUrl}/nft/fetch-nftDB`).toPromise();
            this.nftDB = data;
            // console.log('NFT List From DB:', this.nftDB);
        } catch (err) {
            console.error('Error loading NFT:', err);
        }
    }

    async loadRunesDB() {
        try {
            const data = await firstValueFrom(
              this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
            );
            this.runesDB = data;
            // console.log("RUNES List From DB:", this.runesDB);

            this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
              acc[r.rarity] = [...(acc[r.rarity] || []), r];
              return acc;
            }, {} as Record<string, any[]>);
        } catch (err) {
            console.error("Error loading RUNES:", err);
            this.runesDB = [];
            this.runeMap = {};
        }
    }

    async setLatestNfts() {
        // gabungkan semua NFT & Rune
        const allNft = [...this.nftDB, ...this.runesDB];

        if (allNft.length > 0) {
          // urutkan dari terbaru
          this.latestNfts = allNft
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 4); // ambil 4 terbaru
        }
    }

    goToNftDetail(mintAddress: string) {
        if (!mintAddress) return;
        console.log("Navigating to NFT detail:", mintAddress);
        this.router.navigate(['/nft-detail', mintAddress]);
    }

    logout() {
      this.auth.logout();
    }
}
