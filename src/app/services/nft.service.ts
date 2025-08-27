import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NftService {
  private apiUrl = 'http://localhost:3000/api/nft'; // ganti sesuai backend kamu

  constructor(private http: HttpClient) {}

  getNfts(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}
