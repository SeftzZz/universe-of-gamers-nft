import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { Connection, Transaction } from '@solana/web3.js';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NftService {
  private apiUrl = `${environment.apiUrl}/nft`; // gunakan env, bukan hardcode

  constructor(private http: HttpClient) {}

  // === REST API ===

  getNfts(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getNftById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createNft(nftData: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, nftData);
  }

  updateNft(id: string, nftData: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, nftData);
  }

  deleteNft(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  // === Web3 Transaction ===
  async makeTransaction(owner: string, metadata: any): Promise<string> {
    // 1. Request tx dari backend
    const txResp: any = await firstValueFrom(
      this.http.post(`${this.apiUrl}/make-tx`, { owner, metadata })
    );

    const txBase64 = txResp.tx;
    const tx = Transaction.from(Buffer.from(txBase64, 'base64'));

    // 2. Phantom sign
    const signedTx = await (window as any).solana.signTransaction(tx);

    // 3. Kirim ke cluster
    const connection = new Connection(environment.rpcUrl, 'confirmed');
    const sig = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(sig, 'confirmed');

    console.log('✅ NFT Minted, signature:', sig);
    return sig;
  }

  // === Save ke MongoDB ===
  async saveNft(nftData: any): Promise<any> {
    return await firstValueFrom(this.http.post(this.apiUrl, nftData));
  }
}
