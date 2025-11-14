import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Player {
  player_id: number;
  nickname: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private readonly API_URL = 'http://10.0.0.2:8080/api/players'; // ← Убедитесь, что здесь IP

  constructor(private http: HttpClient) {}

  getAllPlayers(): Observable<Player[]> {
    return this.http.get<Player[]>(`${this.API_URL}/all`);
  }
}