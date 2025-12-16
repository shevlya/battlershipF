// computer-game.service.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

export interface ShipPlacementDto {
  shipId: number;
  size: number;
  row: number; // 0-9
  col: number; // 0-9
  vertical: boolean;
}

export interface ComputerGameStartRequest {
  placementStrategy: string;
  playerShips: ShipPlacementDto[];
}

export interface ComputerGameCreateRequest {
  playerId: number;
  startRequest: ComputerGameStartRequest;
}

export interface ShotRequest {
  gameId: number;
  row: number;
  col: number;
}

export interface ShotResponse {
  hit: boolean;
  sunk: boolean;
  sunkShipId: number;
  gameOver: boolean;
  message: string;

  // Компьютерный ход
  computerRow: number;
  computerCol: number;
  computerHit: boolean;
  computerSunk: boolean;
  computerSunkShipId: number;

  // Статистика
  playerShots: number;
  playerHits: number;
  computerShots: number;
  computerHits: number;
  playerShipsRemaining: number;
  computerShipsRemaining: number;
}

export interface GameStateResponse {
  gameId: number;
  status: string; // waiting, active, completed, cancelled
  playerTurn: boolean;
  lastMoveTime: string;

  // Игровые поля
  playerBoard: string[][]; // SHIP, HIT, MISS, EMPTY
  computerBoard: string[][]; // SHIP, HIT, MISS, EMPTY

  // Статистика
  playerHits?: number;
  playerMisses?: number;
  computerHits?: number;
  computerMisses?: number;
  playerShipsRemaining?: number;
  computerShipsRemaining?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ComputerGameService {
  private readonly apiUrl = 'http://localhost:8080/api/computer-games'; // ИЗМЕНЕНО
  private readonly wsUrl = 'ws://localhost:8080/ws/computer-games'; // ИЗМЕНЕНО

  private socket$!: WebSocketSubject<any>;
  private readonly gameStateSubject = new BehaviorSubject<any>(null);

  constructor(private readonly http: HttpClient) {
    // Не подключаемся автоматически, подключимся при старте игры
  }

  private connectWebSocket() {
    this.socket$ = webSocket(this.wsUrl);

    this.socket$.subscribe(
      (message) => {
        console.log('WebSocket message received:', message);
        if (message.type === 'GAME_UPDATE' || message.type === 'SHOT_RESULT') {
          this.gameStateSubject.next(message.data || message);
        }
      },
      (error) => console.error('WebSocket error:', error),
      () => console.log('WebSocket connection closed')
    );
  }

  // Создать новую игру
  createGame(playerId: number, request: ComputerGameStartRequest): Observable<any> {
    const createRequest: ComputerGameCreateRequest = {
      playerId: playerId,
      startRequest: request
    };
    return this.http.post(`${this.apiUrl}`, createRequest);
  }

  // Настроить игру (расставить корабли)
  setupGame(gameId: number, request: ComputerGameStartRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/${gameId}/setup`, request);
  }

  // Сделать выстрел
  makeShot(gameId: number, row: number, col: number): Observable<ShotResponse> {
    const request: ShotRequest = { gameId, row, col };
    return this.http.post<ShotResponse>(`${this.apiUrl}/${gameId}/shot`, request);
  }

  // Получить состояние игры
  getGameState(gameId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${gameId}/state`);
  }

  // Сдаться
  surrender(gameId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${gameId}/surrender`, {});
  }

  // Подписаться на WebSocket
  subscribeToGame(gameId: number) {
    // Подключаемся к WebSocket при первой подписке
    if (!this.socket$ || this.socket$.closed) {
      this.connectWebSocket();
    }

    setTimeout(() => {
      const message = { type: 'SUBSCRIBE', gameId };
      this.socket$.next(message);
    }, 100);
  }

  // Получить поток обновлений состояния игры
  getGameStateUpdates(): Observable<any> {
    return this.gameStateSubject.asObservable();
  }

  // Закрыть WebSocket соединение
  disconnect() {
    if (this.socket$) {
      this.socket$.complete();
    }
  }
}
