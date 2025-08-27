import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../environments/environment';
import { Transaction } from '@solana/web3.js';
import { Idl } from '../services/idl';

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

  constructor(private fb: FormBuilder, private http: HttpClient, private idlService: Idl) {}

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

}