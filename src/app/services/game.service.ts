import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameResponse, GameState, ShipPlacement } from './models/game.model';
import { ComputerStrategy } from './models/computer.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private apiUrl = '/api/singleplayer';

  constructor(private http: HttpClient) { }

  createSinglePlayerGame(strategy: ComputerStrategy): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.apiUrl}/new`, {
      computerStrategy: strategy
    });
  }

  getSinglePlayerGameState(gameId: number): Observable<GameState> {
    return this.http.get<GameState>(`${this.apiUrl}/${gameId}`);
  }

  makePlayerMove(gameId: number, row: number, col: number): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.apiUrl}/${gameId}/move`, {
      row,
      col
    });
  }

  surrenderGame(gameId: number): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.apiUrl}/${gameId}/surrender`, {});
  }
}
