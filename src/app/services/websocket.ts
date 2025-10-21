import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebSocket {
  private socket?: globalThis.WebSocket; // 👈 pastikan ambil dari global browser
  private messagesSubject = new BehaviorSubject<any>(null);
  messages$ = this.messagesSubject.asObservable();
  
  constructor(private zone: NgZone) {}

  connect() {
    // 👇 pakai globalThis agar eksplisit: ambil WebSocket bawaan browser
    this.socket = new globalThis.WebSocket(`${environment.webSocket}`);

    this.socket.onopen = () => {
      this.zone.run(() => console.log('✅ Connected to WebSocket'));
    };

    this.socket.onmessage = (event: MessageEvent) => {
      this.zone.run(() => {
        const data = JSON.parse(event.data);
        console.log('📨 WS message:', data);
        this.messagesSubject.next(data);
      });
    };

    this.socket.onclose = () => {
      this.zone.run(() => console.warn('❌ WebSocket closed'));
    };
  }

  send(data: any) {
    if (this.socket?.readyState === globalThis.WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ Socket not ready');
    }
  }
}
