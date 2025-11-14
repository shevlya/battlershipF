import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Player {
  player_id: number;
  nickname: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  private readonly API_URL = `${environment.apiUrl}/api/players`;

  constructor(private http: HttpClient) {}

  getAllPlayers(): Observable<Player[]> {
    return this.http.get<Player[]>(`${this.API_URL}/all`);
  }
}