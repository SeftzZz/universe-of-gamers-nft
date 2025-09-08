import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../environments/environment';
import { Transaction } from '@solana/web3.js';
import { Idl } from '../services/idl';

import { ToastController } from '@ionic/angular'; // untuk notif ===add by fpp 05/09/25===

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  program: any;

  userAddress: string | null = null;
  balance: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;

  formData: any = {
    name: 'Monster UOG',
    symbol: 'MUOG',
    uri: 'https://metadata.universeofgamers.io/muog.json',
    description: 'Monster with Trident',
    price: '0.001',
    properties: 'No Properties',
    size: '10',
    blockchain: 'Solana',
    collection: 'UOG Collections',
    royalty: '8',
    owner: this.userAddress,
  };
  selectedFile: File | null = null;

  nft: any[] = []; // daftar NFT dari backend
  characters: any[] = [];   // daftar karakter dari backend ===add by fpp 05/09/25===
  selectedCharacter: string | null = null; // ===add by fpp 05/09/25===

  charData: any = {
    displayName: "",
    element: "Fire",
    level: 1,
    hp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    critRate: 0,
    critDmg: 0,
    basicAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    skillAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
    ultimateAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" }
  };

  runeDefault = {
    itemName: "",
    hpBonus: 0,
    atkBonus: 0,
    defBonus: 0,
    spdBonus: 0,
    critRateBonus: 0,
    critDmgBonus: 0,
    description: ""
  };

  runeList: any[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private idlService: Idl,
    private toastCtrl: ToastController   // untuk notif ===add by fpp 05/09/25===
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
      this.updateBalance();
    }

    await this.loadNft();
    await this.loadCharacters();   // load data karakter ===add by fpp 05/09/25===
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      this.userAddress = resp.publicKey.toString();

      if (this.userAddress) {
        localStorage.setItem('walletAddress', this.userAddress);

        // ✅ update ke formData
        this.formData.owner = this.userAddress;
      }

      await this.updateBalance();
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
    this.balance = null;
  }

  async updateBalance() {
    if (!this.userAddress) return;
    try {
      const connection = new Connection(environment.rpcUrl, 'confirmed');
      const pubkey = new PublicKey(this.userAddress);
      const lamports = await connection.getBalance(pubkey);
      this.balance = lamports / LAMPORTS_PER_SOL;
    } catch (err) {
      console.error('Error fetch balance', err);
    }
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

  async submit() {
    if (!this.userAddress) {
      alert("Please connect wallet first");
      return;
    }

    this.formData.owner = this.userAddress;

    try {
      // 1. Request serialized tx dari backend
      const txResp: any = await this.http.post(
        `${environment.apiUrl}/nft/make-tx`,
        { owner: this.userAddress, metadata: this.formData }
      ).toPromise();

      const txBase64 = txResp.tx;
      const tx = Transaction.from(Buffer.from(txBase64, "base64"));

      // 2. Phantom sign
      const signedTx = await (window as any).solana.signTransaction(tx);

      // 3. Kirim ke cluster
      const connection = new Connection(environment.rpcUrl, 'confirmed');
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      console.log("✅ NFT Minted, signature:", sig);
      alert("✅ NFT Minted\nTx: " + sig);

    } catch (err) {
      console.error("❌ Submit error", err);
      if (err instanceof Error) {
        alert("❌ Error: " + err.message);
      } else {
        alert("❌ Error: " + JSON.stringify(err));
      }
    }
  }

  async loadNft() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/nft`).toPromise();
      this.nft = data;
      console.log('📦 NFT List:', this.nft);
    } catch (err) {
      console.error('❌ Error loading NFT:', err);
    }
  }

  // ===add by fpp 05/09/25===
  async loadCharacters() {
    try {
      const data: any = await this.http.get(`${environment.apiUrl}/characters`).toPromise();
      this.characters = data;
      console.log("Characters:", this.characters);
    } catch (err) {
      console.error("Error loading characters:", err);
    }
  }
  // =========================

  // ===add by fpp 05/09/25===
  resetFormCreateCharacter() {
    this.charData = {
      displayName: "",
      element: "Fire",
      level: 1,
      hp: 0,
      atk: 0,
      def: 0,
      spd: 0,
      critRate: 0,
      critDmg: 0,
      basicAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
      skillAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" },
      ultimateAttack: { skillName: "", atkMultiplier: 0, defMultiplier: 0, hpMultiplier: 0, description: "" }
    };
  }
  // ==========================

  submitCharacter() {
    console.log("Submitting character:", this.charData);
    // ===edit by fpp 05/09/25===
    // this.http.post(`${environment.apiUrl}/nft/character`, this.charData).subscribe(res => {
    //   console.log("✅ Character saved", res);
    // });
    // ==========================

    // ===add by fpp 05/09/25===
    this.http.post(`${environment.apiUrl}/nft/character`, this.charData).subscribe({
      next: async (res) => {
        console.log("Character saved", res);
        
        // tampilkan toast sukses
        const toast = await this.toastCtrl.create({
          message: 'Character Successfully Created!',
          duration: 5000,
          color: 'success',
          position: 'top'
        });
        toast.present();

        // reset form setelah toast tampil
        this.resetFormCreateCharacter();
      },
      error: async (err) => {
        console.error("Error saving character", err);

        // tampilkan toast error
        const toast = await this.toastCtrl.create({
          message: 'Failed to Create a Character!',
          duration: 5000,
          color: 'danger',
          position: 'top'
        });
        toast.present();
      }
    });
    // ==========================
  }

  addRune() {
    this.runeList.push({
      itemName: "",
      hpBonus: 0,
      atkBonus: 0,
      defBonus: 0,
      spdBonus: 0,
      critRateBonus: 0,
      critDmgBonus: 0,
      description: ""
    });
  }

  submitRune() {
    const allRunes = [this.runeDefault, ...this.runeList];
    console.log("Submitting Runes:", allRunes);
    this.http.post(`${environment.apiUrl}/nft/rune`, this.runeDefault).subscribe(res => {
      console.log("✅ Rune saved", res);
    });
  }

}