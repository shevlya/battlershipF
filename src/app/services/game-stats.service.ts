import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  savedLayouts: number;
}

@Injectable({
  providedIn: 'root'
})
export class GameStatsService {
  private readonly API_URL = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // Получение статистики игрока по ID
  getPlayerStats(playerId: number): Observable<GameStats> {
    return this.http.get<GameStats>(`${this.API_URL}/players/${playerId}/stats`);
  }

  // Получение статистики текущего пользователя
  getCurrentPlayerStats(): Observable<GameStats> {
    return this.http.get<GameStats>(`${this.API_URL}/players/current/stats`);
  }
}