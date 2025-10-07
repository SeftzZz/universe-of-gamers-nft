import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Idl } from '../services/idl';
import { NftService } from '../services/nft.service';
import { AuthRedirect } from '../services/auth-redirect';
import { firstValueFrom } from 'rxjs';
import { ToastController } from '@ionic/angular'; 
import { Router } from '@angular/router';

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
  selector: 'app-explorer',
  templateUrl: './explorer.page.html',
  styleUrls: ['./explorer.page.scss'],
  standalone: false,
})
export class ExplorerPage implements OnInit {
  program: any;

  userAddress: string | null = null;

  nftCharacter: any[] = [];
  nftRune: any[] = [];

  characters: any[] = [];   
  runes: any[] = [];   
  selectedCharacter: string | null = null; 

  characterMap: Record<string, any[]> = {};
  runeMap: Record<string, any[]> = {};

  isOpen = false;
  selected = '';
  activeTab: 'character' | 'rune' = 'character';

  // pagination
  itemsToShowCharacter = 8;
  itemsToShowRune = 8;
  loadStep = 8;

  constructor(
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,
    private nftService: NftService,
    private authRedirect: AuthRedirect,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.program = await this.idlService.loadProgram();

    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
    }

    await this.loadNft();
    await this.loadCharacters();
    await this.loadRunes();
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async loadNft() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/fetch-nft`)
        .toPromise();

      this.nftCharacter = data.filter((item: INftItem) => !!item.character);
      this.nftRune = data.filter((item: INftItem) => !!item.rune);

      console.log('📦 NFT Character:', this.nftCharacter);
      console.log('📦 NFT Rune:', this.nftRune);
    } catch (err) {
      console.error('❌ Error loading NFT:', err);
      this.nftCharacter = [];
      this.nftRune = [];
    }
  }

  async loadCharacters() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/fetch-character`)
      );
      this.characters = data;
      this.characterMap = data.reduce((acc: Record<string, any[]>, c: any) => {
        acc[c.rarity] = [...(acc[c.rarity] || []), c];
        return acc;
      }, {});
    } catch (err) {
      console.error("❌ Error loading characters:", err);
      this.characters = [];
      this.characterMap = {};
    }
  }

  async loadRunes() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runes = data;
      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {});
    } catch (err) {
      console.error("❌ Error loading runes:", err);
      this.runes = [];
      this.runeMap = {};
    }
  }

  goToNftDetail(mintAddress: string) {
    const target = `/market-layout/nft-detail/${mintAddress}`;
    this.authRedirect.setNextRoute(target);

    if (!this.userAddress) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate([target]);
    }
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  switchTab(tab: 'character' | 'rune') {
    this.activeTab = tab;
    this.isOpen = false;
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

    this.isOpen = false;
  }

  loadMoreCharacter() {
    this.itemsToShowCharacter += this.loadStep;
  }

  loadMoreRune() {
    this.itemsToShowRune += this.loadStep;
  }
}
