import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Idl } from '../services/idl';
import { NftService } from '../services/nft.service';
import { AuthRedirect } from '../services/auth-redirect';
import { firstValueFrom } from 'rxjs';
import { ToastController } from '@ionic/angular'; // untuk notif ===add by fpp 05/09/25===
import { Router } from '@angular/router';

interface IGatchaReward {
  type: "character" | "rune";
  rarity: string;
  chance: number;
  previewImages?: string[];
}

interface IGatchaPack {
  _id: string;
  name: string;
  description: string;
  priceUOG: number;
  priceSOL: number;
  rewards: IGatchaReward[];
}

interface INftItem {
  _id: string;
  name: string;
  description: string;
  image: string;
  owner: string;
  character?: string;
  rune?: string;
  [key: string]: any; // biar fleksibel
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
  balance: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;

  formData: any = {
    name: '',
    description: '',
    image: '',
    price: 0,
    royalty: 0,
    character: '',
    owner: ''
  };
  selectedFile: File | null = null;

  nft: any[] = []; // daftar NFT dari backend
  nftCharacter: any[] = [];
  nftRune: any[] = [];

  characters: any[] = [];   // daftar karakter dari backend ===add by fpp 05/09/25===
  runes: any[] = [];   // daftar rune dari backend
  selectedCharacter: string | null = null; // ===add by fpp 05/09/25===

  charData: any = {
    name: "",
    description: "",
    image: "",
    element: "Fire",
    rarity: "Common",

    baseHp: 0,
    baseAtk: 0,
    baseDef: 0,
    baseSpd: 0,
    baseCritRate: 0,
    baseCritDmg: 0,

    basicAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    skillAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    ultimateAttack: { name: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" }
  };

  runeDefault = {
    name: "",
    image: "",
    rarity: "Common",
    hpBonus: 0,
    atkBonus: 0,
    defBonus: 0,
    spdBonus: 0,
    critRateBonus: 0,
    critDmgBonus: 0,
    description: ""
  };

  runeList: any[] = [];

  // === Gatcha Pack ===
  gatchaData: any = {
    name: "",
    description: "",
    priceUOG: 0,
    priceSOL: 0,
  };
  gatchaRewards: any[] = [
    { type: "character", rarity: "Common", chance: 50 },
    { type: "rune", rarity: "Rare", chance: 50 }
  ];
  uogToSolRate: number = 0; // rate 1 UOG → SOL
  solToUogRate: number = 0; // rate 1 SOL → UOG

  gatchaPacks: any[] = [];
  mintResult: any = null;

  gatchaForm: any = {
    packId: '',
  };

  characterMap: Record<string, any[]> = {};
  runeMap: Record<string, any[]> = {};

  private shuffleArray<T>(array: T[]): T[] {
    return array
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value);
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController,   // untuk notif ===add by fpp 05/09/25===
    private nftService: NftService,
    private authRedirect: AuthRedirect,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.program = await this.idlService.loadProgram();
    // sekarang this.program bisa dipakai untuk call mintAndList, buyNft, dll.

    this.uploadForm = this.fb.group({
      name: ['', Validators.required],
      symbol: ['', Validators.required],
      uri: ['', Validators.required],
      description: ['', Validators.required],
      price: ['', Validators.required],
      properties: ['', Validators.required],
      size: ['', Validators.required],
      collection: ['', Validators.required],
      royalty: ['', Validators.required],
    });

    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
    }

    await this.loadNft();
    await this.loadCharacters();   // load data karakter ===add by fpp 05/09/25===
    await this.loadRunes();
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
    this.balance = null;
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // --- Upload Logic ---
  onFileChange(event: any) {
    this.selectedFile = event.target.files[0] || null;
  }

  selectBlockchain(chain: string) {
    console.log('chain selected', chain);
    this.formData.blockchain = chain;
  }

  preview() {
    const data = {
      ...this.formData,
      file: this.selectedFile?.name || 'No file'
    };
    console.log('🔎 Preview Data:', data);
    alert('Preview:\n' + JSON.stringify(data, null, 2));
  }

  async loadNft() {
    try {
      const data: any = await this.http
        .get(`${environment.apiUrl}/nft/fetch-nft`)
        .toPromise();

      // 🔥 Pisahkan berdasarkan field
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

  // ===add by fpp 05/09/25===
  async loadCharacters() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/fetch-character`)
      );
      this.characters = data;
      console.log("Characters:", this.characters);

      this.characterMap = data.reduce((acc: Record<string, any[]>, c: any) => {
        acc[c.rarity] = [...(acc[c.rarity] || []), c];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("❌ Error loading characters:", err);
      this.characters = [];
      this.characterMap = {};
    }
  }
  // =========================

  async loadRunes() {
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiUrl}/nft/rune`)
      );
      this.runes = data;
      console.log("Runes:", this.runes);

      this.runeMap = data.reduce((acc: Record<string, any[]>, r: any) => {
        acc[r.rarity] = [...(acc[r.rarity] || []), r];
        return acc;
      }, {} as Record<string, any[]>);
    } catch (err) {
      console.error("❌ Error loading runes:", err);
      this.runes = [];
      this.runeMap = {};
    }
  }

  goToNftDetail(mintAddress: string) {
    const target = `/nft-detail/${mintAddress}`;
    this.authRedirect.setNextRoute(target);

    if (!this.userAddress) {
      // belum login
      this.router.navigate(['/login']);
    } else {
      // sudah login
      this.router.navigate([target]);
    }
  }
}