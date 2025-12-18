import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import {ComputerGame} from "./computer-game.interface";

// DTO интерфейсы
export interface ShipPlacementDto {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

export interface ComputerGameStartRequest {
  placementStrategy: string;
  playerShips: ShipPlacementDto[];
}

export interface ShotResponse {
  hit: boolean;
  sunk: boolean;
  sunkShipId: number;
  gameOver: boolean;
  message: string;
  computerRow?: number;
  computerCol?: number;
  computerHit?: boolean;
  computerSunk?: boolean;
  computerSunkShipId?: number;
  playerShots?: number;
  playerHits?: number;
  computerShots?: number;
  computerHits?: number;
  playerShipsRemaining?: number;
  computerShipsRemaining?: number;
  playerTurn?: boolean;
}

export interface GameStateResponse {
  gameId: number;
  status: string;
  playerTurn: boolean;
  lastMoveTime?: string;
  playerBoard: string[][];
  computerBoard: string[][];
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
  // Используйте относительный путь, если настроен прокси
  private readonly apiUrl = '/api/computer-game'; // относительный путь для прокси
  // Или абсолютный, если нет прокси:
  // private readonly apiUrl = 'http://localhost:8080/api/computer-game';

  private readonly wsUrl = 'ws://localhost:8080/ws/computer-game';

  private socket$!: WebSocketSubject<any>;
  private isConnected = false;
  private readonly gameStateSubject = new BehaviorSubject<any>(null);

  constructor(private readonly http: HttpClient) {}

  // Создать новую игру
  createComputerGame(playerId: number, request: ComputerGameStartRequest): Observable<any> {
    console.log('=== CREATE COMPUTER GAME ===');
    console.log('Player ID:', playerId);
    console.log('Request:', request);

    // Используйте /start или /create - смотрите, какой endpoint работает
    const url = `${this.apiUrl}/start?playerId=${playerId}`;
    // ИЛИ: const url = `${this.apiUrl}/create?playerId=${playerId}`;

    console.log('URL:', url);

    return this.http.post(url, request).pipe(
      tap(response => {
        console.log('Create game response:', response);
        // Сохраняем gameId
        if (response && response.gameId) {
          localStorage.setItem('currentGameId', response.gameId.toString());
        }
      }),
      catchError(error => {
        console.error('Create game error:', error);
        return throwError(() => error);
      })
    );
  }

  // Настроить игру (расставить корабли)
  setupGame(gameId: number, request: ComputerGameStartRequest): Observable<any> {
    console.log('=== SETUP GAME ===');
    console.log('Game ID:', gameId);

    const url = `${this.apiUrl}/${gameId}/setup`;
    console.log('URL:', url);

    return this.http.post(url, request).pipe(
      tap(response => {
        console.log('Setup game response:', response);
      }),
      catchError(error => {
        console.error('Setup game error:', error);
        return throwError(() => error);
      })
    );
  }

  // Сделать выстрел
  makeShot(gameId: number, row: number, col: number): Observable<ShotResponse> {
    console.log('=== MAKE SHOT ===');
    console.log('Game ID:', gameId, 'at [', row, ',', col, ']');

    const url = `${this.apiUrl}/${gameId}/shot`;
    console.log('URL:', url);

    const request = { row, col }; // Согласно контроллеру: @RequestBody ShotRequest request
    return this.http.post<ShotResponse>(url, request).pipe(
      tap(response => console.log('Shot response:', response)),
      catchError(error => {
        console.error('Shot error:', error);
        return throwError(() => error);
      })
    );
  }

  // Получить состояние игры
  getGameState(gameId: number): Observable<GameStateResponse> {
    console.log('=== GET GAME STATE ===');
    console.log('Game ID:', gameId);

    const url = `${this.apiUrl}/${gameId}/state`;
    console.log('URL:', url);

    return this.http.get<GameStateResponse>(url).pipe(
      tap(response => console.log('Game state response:', response)),
      catchError(error => {
        console.error('Get game state error:', error);
        return throwError(() => error);
      })
    );
  }

  // Сдаться
  surrender(gameId: number): Observable<void> {
    console.log('=== SURRENDER ===');
    console.log('Game ID:', gameId);

    const url = `${this.apiUrl}/${gameId}/surrender`;
    console.log('URL:', url);

    return this.http.post<void>(url, {}).pipe(
      tap(() => console.log('Surrender successful')),
      catchError(error => {
        console.error('Surrender error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Получить историю игр пользователя
   */
  getPlayerGames(playerId: string): Observable<ComputerGame[]> {
    return this.http.get<ComputerGame[]>(
      `${this.apiUrl}/computer-games/player/${playerId}/history`
    );
  }
  /**
   * Подписаться на игру через WebSocket
   */
  subscribeToGame(gameId: number): void {
    if (!this.isConnected || !this.socket$ || this.socket$.closed) {
      this.connectWebSocket();
    }

    setTimeout(() => {
      if (this.socket$ && !this.socket$.closed) {
        const message = { type: 'SUBSCRIBE', gameId };
        this.socket$.next(message);
      }
    }, 500);
  }

  /**
   * Подключиться к WebSocket
   */
  private connectWebSocket(): void {
    this.socket$ = webSocket(this.wsUrl);
    this.isConnected = true;

    this.socket$.subscribe({
      next: (message) => this.gameStateSubject.next(message),
      error: (err) => {
        console.error('WebSocket error:', err);
        this.isConnected = false;
      },
      complete: () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
      }
    });
  }

  /**
   * Получить обновления состояния игры через WebSocket
   */
  getGameStateUpdates(): Observable<any> {
    return this.gameStateSubject.asObservable();
  }

  /**
   * Отписаться от WebSocket
   */
  unsubscribeFromGame(gameId: number): void {
    if (this.socket$ && !this.socket$.closed) {
      const message = { type: 'UNSUBSCRIBE', gameId };
      this.socket$.next(message);
    }
  }

  /**
   * Закрыть WebSocket соединение
   */
  disconnectWebSocket(): void {
    if (this.socket$) {
      this.socket$.complete();
      this.isConnected = false;
    }
  }
}
