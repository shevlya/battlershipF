// computer-game.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

// Экспортируем интерфейсы
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
  computerRow?: number;
  computerCol?: number;
  computerHit?: boolean;
  computerSunk?: boolean;
  computerSunkShipId?: number;

  // Статистика
  playerShots?: number;
  playerHits?: number;
  computerShots?: number;
  computerHits?: number;
  playerShipsRemaining?: number;
  computerShipsRemaining?: number;

  // Очередь хода
  playerTurn?: boolean;
}

export interface GameStateResponse {
  gameId: number;
  status: string; // waiting, active, completed, cancelled
  playerTurn: boolean;
  lastMoveTime?: string;

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
  // ИСПРАВЬТЕ: URL должен совпадать с контроллером (без 's' на конце!)
  private readonly apiUrl = 'http://localhost:8080/api/computer-game'; // БЕЗ 's' на конце!
  private readonly wsUrl = 'ws://localhost:8080/ws/computer-games';

  private socket$!: WebSocketSubject<any>;
  private readonly gameStateSubject = new BehaviorSubject<any>(null);

  constructor(private readonly http: HttpClient) {
    // Не подключаемся автоматически, подключимся при старте игры
  }

  private connectWebSocket() {
    console.log('WebSocket: Connecting to', this.wsUrl);
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
    console.log('=== CREATE GAME ===');
    console.log('Player ID:', playerId);
    console.log('Request:', request);

    const url = `${this.apiUrl}/start?playerId=${playerId}`;
    console.log('URL:', url);

    return this.http.post(url, request).pipe(
      tap(response => console.log('Create game response:', response)),
      catchError(error => {
        console.error('Create game error:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error body:', error.error);
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
      tap(response => console.log('Setup game response:', response)),
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

    const request: ShotRequest = { gameId, row, col };
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
        console.error('Full error:', JSON.stringify(error, null, 2));
        return throwError(() => error);
      })
    );
  }

  // Подписаться на WebSocket
  subscribeToGame(gameId: number) {
    console.log('=== SUBSCRIBE TO GAME ===');
    console.log('Game ID:', gameId);

    if (!this.socket$ || this.socket$.closed) {
      this.connectWebSocket();
    }

    setTimeout(() => {
      const message = { type: 'SUBSCRIBE', gameId };
      console.log('Sending WebSocket message:', message);
      if (this.socket$) {
        this.socket$.next(message);
      }
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

  // Вспомогательный метод для отладки
  logCurrentState() {
    console.log('ComputerGameService state:', {
      apiUrl: this.apiUrl,
      wsUrl: this.wsUrl,
      hasSocket: !!this.socket$,
      socketClosed: this.socket$?.closed
    });
  }
}
