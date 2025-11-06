import { Injectable } from '@angular/core';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

@Injectable({ providedIn: 'root' })
export class Phantom {
  private dappKeys: nacl.BoxKeyPair | null = null;
  private nonce: Uint8Array | null = null;

  constructor() {
    this.restoreOrGenerateSession();
  }

  /** 🔄 Restore keypair & nonce dari localStorage, atau generate baru jika belum ada */
  private restoreOrGenerateSession() {
    try {
      const secret = localStorage.getItem('dappSecretKey');
      const nonceStr = localStorage.getItem('dappNonce');

      if (secret) {
        this.dappKeys = nacl.box.keyPair.fromSecretKey(bs58.decode(secret));
        console.log('♻️ [Phantom] Restored dApp keypair from localStorage');
      } else {
        this.dappKeys = nacl.box.keyPair();
        localStorage.setItem('dappSecretKey', bs58.encode(this.dappKeys.secretKey));
        console.log('🆕 [Phantom] Generated new dApp keypair');
      }

      if (nonceStr) {
        this.nonce = bs58.decode(nonceStr);
      } else {
        this.nonce = nacl.randomBytes(24);
        localStorage.setItem('dappNonce', bs58.encode(this.nonce));
      }
    } catch (err) {
      console.warn('⚠️ [Phantom] Failed to restore session, regenerating...', err);
      this.generateSession();
    }
  }

  /** 🔑 Generate session baru (manual reset jika diperlukan) */
  generateSession() {
    this.dappKeys = nacl.box.keyPair();
    this.nonce = nacl.randomBytes(24);
    localStorage.setItem('dappSecretKey', bs58.encode(this.dappKeys.secretKey));
    localStorage.setItem('dappNonce', bs58.encode(this.nonce));
    console.log('🔑 [Phantom] Session generated & stored');
  }

  /** 🧠 Public key (Base58) untuk dapp_encryption_public_key */
  getPublicKeyB58(): string {
    if (!this.dappKeys) {
      console.warn('⚠️ [Phantom] Missing dApp keys, regenerating...');
      this.restoreOrGenerateSession();
    }
    return bs58.encode(this.dappKeys!.publicKey);
  }

  /** 🧩 Secret key Uint8Array (private) */
  getSecretKey(): Uint8Array {
    if (!this.dappKeys) this.restoreOrGenerateSession();
    return this.dappKeys!.secretKey;
  }

  /** 🧩 Nonce Base58 (selalu tersedia) */
  getNonceB58(): string {
    if (!this.nonce) {
      this.nonce = nacl.randomBytes(24);
      localStorage.setItem('dappNonce', bs58.encode(this.nonce));
    }
    return bs58.encode(this.nonce);
  }

  /** ⚙️ Ambil pasangan keypair penuh */
  getKeypair(): nacl.BoxKeyPair {
    if (!this.dappKeys) this.restoreOrGenerateSession();
    return this.dappKeys!;
  }

  /** 🧩 Restore keypair dari secret key Uint8Array */
  restoreKeypairFromSecret(secret: Uint8Array) {
    this.dappKeys = nacl.box.keyPair.fromSecretKey(secret);
    console.log('♻️ [Phantom] Keypair restored from secret');
  }
}
