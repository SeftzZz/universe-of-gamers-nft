import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: "root" })
export class GatchaService {
  public gatchaResult$ = new BehaviorSubject<any>(null);
}
