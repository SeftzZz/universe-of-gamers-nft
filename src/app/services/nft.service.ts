import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
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

  // === Save ke MongoDB ===
  async saveNft(nftData: any): Promise<any> {
    return await firstValueFrom(this.http.post(this.apiUrl, nftData));
  }
}
