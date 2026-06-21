import { Router } from '@angular/router';
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WebSocketService, GameStartNotification } from '../../services/webSocket.service';
import { Subscription as RxSubscription } from 'rxjs';

// Тип для Stomp подписки
type StompSubscription = any;

interface GameState {
  myField: string[][];        // Ваши корабли
  opponentField: string[][];  // Поле противника с вашими выстрелами (H/M)
  myHits: string[][];         // Ваши выстрелы (дублирует opponentField)
  opponentHits: string[][];   // Выстрелы противника (дублирует enemyHits)
  myShipsLeft: number;
  opponentShipsLeft: number;
  isMyTurn: boolean;
  currentTurnPlayerId: number;
  gameId: number;
}

interface GameMoveDTO {
  gameId: number;
  playerId: number;
  row: number;
  column: number;
}

@Component({
  selector: 'app-two-players-field-page',
  templateUrl: './two-players-field-page.component.html',
  styleUrls: ['./two-players-field-page.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class TwoPlayersFieldComponent implements OnChanges, OnInit, OnDestroy {
  gameId: string = '';
  private gameIdNum: number = 0;
  private playerId: number = 0;
  @Input() myName: string = '';
  @Input() opponentName: string = '';
  @Input() currentPlayerId: number = 0;
  @Input() gameState: GameState = {
    myField: [],
    opponentField: [],
    myHits: [],
    opponentHits: [],
    myShipsLeft: 0,
    opponentShipsLeft: 0,
    isMyTurn: false,
    currentTurnPlayerId: 0,
    gameId: 0
  };
  @Output() cellSelected = new EventEmitter<{ row: number; col: number }>();
  @Output() gameAction = new EventEmitter<{ type: string; data?: any }>();

  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  showPausePopup = false;
  showDrawPopup = false;
  showDrawResponsePopup = false;
  showSurrenderPopup = false;
  myShotsCount = 0;
  myHitsCount = 0;

  private rxSubscriptions: RxSubscription[] = [];
  private stompSubscriptions: StompSubscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private webSocketService: WebSocketService,
    private router: Router
  ) {}

  ngOnInit() {
    // 1. Подписываемся на параметры маршрута
    const paramsSub = this.route.params.subscribe(params => {
      if (params['gameId']) {
        this.handleRouteParams(params);
      }
    });
    this.rxSubscriptions.push(paramsSub);

    // 2. Проверяем snapshot на случай быстрой навигации
    const snapshotParams = this.route.snapshot.params;
    if (snapshotParams['gameId']) {
      this.handleRouteParams(snapshotParams);
    }

    // 3. Проверяем queryParams
    this.route.queryParams.subscribe(queryParams => {
      if (queryParams['gameId'] && !this.gameId) {
        this.gameId = queryParams['gameId'];
        this.gameIdNum = parseInt(this.gameId, 10);
        console.log('Получен ID игры из queryParams:', this.gameId);

        this.playerId = this.getPlayerId();
        console.log('Player ID установлен из queryParams:', this.playerId);

        if (this.playerId > 0) {
          this.setupGameSubscriptions();
          this.requestGameState();
        }
      }

      // Проверяем currentPlayerId в queryParams
      if (queryParams['currentPlayerId'] && !this.playerId) {
        this.playerId = parseInt(queryParams['currentPlayerId'], 10);
        console.log('Player ID взят из queryParams currentPlayerId:', this.playerId);
        if (this.gameIdNum > 0 && this.playerId > 0) {
          this.setupGameSubscriptions();
          this.requestGameState();
        }
      }
    });

    // 4. Если currentPlayerId передан через @Input
    if (this.currentPlayerId && this.currentPlayerId > 0 && !this.playerId) {
      this.playerId = this.currentPlayerId;
      console.log('Player ID установлен из @Input:', this.playerId);
      if (this.gameIdNum > 0) {
        this.setupGameSubscriptions();
        this.requestGameState();
      }
    }
  }

  private handleRouteParams(params: any) {
    this.gameId = params['gameId'];
    this.gameIdNum = parseInt(this.gameId, 10);
    console.log('Получен ID игры из параметров маршрута:', this.gameId);

    this.playerId = this.getPlayerId();
    console.log('Player ID определен:', this.playerId);

    if (this.playerId > 0) {
      this.setupGameSubscriptions();
      this.requestGameState();
    } else {
      console.error('Player ID не найден, невозможно установить подписки');
    }
  }

  private getPlayerId(): number {
    console.log('🔍 Поиск playerId из всех доступных источников:');

    // 1. Проверяем queryParams текущего маршрута
    const queryParams = this.route.snapshot.queryParams;
    if (queryParams['playerId']) {
      const id = +queryParams['playerId'];
      console.log('Player ID найден в queryParams:', id);
      return id;
    }

    // 2. Проверяем параметры маршрута
    const routeParams = this.route.snapshot.params;
    if (routeParams['playerId']) {
      const id = +routeParams['playerId'];
      console.log('Player ID найден в параметрах маршрута:', id);
      return id;
    }

    // 3. Проверяем sessionStorage
    const sessionId = sessionStorage.getItem('currentPlayerId');
    if (sessionId && !isNaN(parseInt(sessionId))) {
      const id = parseInt(sessionId);
      console.log('Player ID найден в sessionStorage:', id);
      return id;
    }

    // 4. Проверяем состояние WebSocketService
    if (this.webSocketService.isConnected() && this.webSocketService.getCurrentPlayerId()) {
      const id = this.webSocketService.getCurrentPlayerId()!;
      console.log('Player ID найден в WebSocketService:', id);
      return id;
    }

    // 5. Проверяем @Input currentPlayerId
    if (this.currentPlayerId && this.currentPlayerId > 0) {
      console.log('Player ID взят из @Input currentPlayerId:', this.currentPlayerId);
      return this.currentPlayerId;
    }

    console.error('Player ID не найден ни в одном источнике');
    return 0;
  }

  private setupGameSubscriptions() {
    if (!this.gameIdNum || !this.playerId || this.playerId === 0) {
      console.warn('Не могу подписаться: gameId или playerId не установлены');
      return;
    }

    console.log('Настраиваю все необходимые подписки для gameId:', this.gameIdNum, 'playerId:', this.playerId);

    // 1. Подписка на начало игры - КРИТИЧЕСКИ ВАЖНО
    this.subscribeToGameStart();

    // 2. Подписка на обновления состояния игры
    this.subscribeToGameState();

    // 3. Подписка на завершение игры
    this.subscribeToGameEnd();

    // 4. Подписка на ошибки
    this.subscribeToErrors();

    // 5. Подписка на предложения ничьи
    this.subscribeToDrawOffers();
  }

  private subscribeToGameStart() {
    console.log('🔧 Подписка на уведомления о начале игры');
    const subscription = this.webSocketService.subscribeToGameStart((notification: GameStartNotification) => {
      console.log('🎮 Получено уведомление о начале игры:', notification);

      // Обновляем gameId если он пришел в уведомлении
      if (notification.gameId && notification.gameId > 0) {
        this.gameIdNum = notification.gameId;
        console.log('🎮 Обновлен gameId:', this.gameIdNum);
      }

      // Обновляем состояние хода
      if (notification.currentTurnPlayerId != null) { // проверяет и null, и undefined
        const turnPlayerId = notification.currentTurnPlayerId; // теперь TypeScript знает: это number
        this.gameState.isMyTurn = turnPlayerId === this.playerId;
        this.gameState.currentTurnPlayerId = turnPlayerId; // о
        console.log('🎮 Обновлен статус хода. Мой ход?', this.gameState.isMyTurn);
      }

      // Запрашиваем состояние игры после получения уведомления
      if (this.gameIdNum > 0) {
        console.log('Запрашиваем состояние игры после получения уведомления о начале');
        this.requestGameState();
      }
    });

    if (subscription) {
      this.stompSubscriptions.push(subscription);
    }
  }

  private requestGameState() {
    if (!this.gameIdNum || !this.playerId) {
      console.warn('Не могу запросить состояние игры: отсутствуют gameId или playerId');
      return;
    }

    console.log('📡 Запрашиваем состояние игры для gameId:', this.gameIdNum, 'playerId:', this.playerId);
    this.webSocketService.sendGetGameState({
      gameId: this.gameIdNum,
      playerId: this.playerId
    });
  }

  private subscribeToGameState() {
    console.log('🔧 Подписка на обновления состояния игры');
    const subscription = this.webSocketService.subscribeToGameState(
      this.playerId,
      (gameState: any) => {
        console.log('Получено состояние игры:', gameState);
        this.updateGameState(gameState);
      }
    );

    if (subscription) {
      this.stompSubscriptions.push(subscription);
    }
  }

  private updateGameState(gameState: any) {
    console.log('Обновление состояния игры. Полученные данные:', gameState);
    console.log('Мой playerId:', this.playerId);
    console.log('Текущий ход игрока (от сервера):', gameState.currentTurnPlayerId);

    // Сохраняем предыдущее состояние хода для логирования
    const previousTurn = this.gameState.isMyTurn;

    // Обновляем состояние игры
    this.gameState = {
      ...this.gameState,
      ...gameState,
      // Важно: явно определяем чей сейчас ход на основе данных от сервера
      isMyTurn: gameState.currentTurnPlayerId === this.playerId,
      currentTurnPlayerId: gameState.currentTurnPlayerId
    };

    this.updateStats();

    console.log('Состояние обновлено:');
    console.log('   - Мой ход?', this.gameState.isMyTurn);
    console.log('   - Был мой ход?', previousTurn);
    console.log('   - Текущий ход (сервер):', gameState.currentTurnPlayerId);
    console.log('   - Мой ID:', this.playerId);
    console.log('   - Корабли противника осталось:', this.gameState.opponentShipsLeft);
    console.log('   - Мои корабли осталось:', this.gameState.myShipsLeft);
  }

  get isYourTurn(): boolean {
    return this.gameState?.isMyTurn ?? false;
  }

  get myShipsCount(): number {
    return this.gameState?.myShipsLeft ?? 0;
  }

  get opponentShipsCount(): number {
    return this.gameState?.opponentShipsLeft ?? 0;
  }

  get myField(): string[][] {
    return this.gameState?.myField || this.createEmptyStringField();
  }

  get opponentField(): string[][] {
    return this.gameState?.opponentField || this.createEmptyStringField();
  }

  get myHits(): string[][] {
    return this.gameState?.myHits || this.createEmptyStringField();
  }
  private createEmptyStringField(): string[][] {
    return Array(10).fill(null).map(() => Array(10).fill(' '));
  }


  get opponentHits(): string[][] {
    return this.gameState?.opponentHits && this.gameState.opponentHits.length ?
      this.gameState.opponentHits : this.createEmptyHitsField();
  }

  /**
   * Обработка клика по клетке поля противника
   */
  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn || this.opponentField[row]?.[col] !== ' ') {
      return;
    }
    this.sendMove(row, col);
  }

  private canMakeMove(row: number, col: number): boolean {
    return this.isYourTurn &&
      this.opponentHits[row] &&
      !this.isCellAlreadyHit(row, col);
  }

  private isCellAlreadyHit(row: number, col: number): boolean {
    // Проверяем opponentField, а не opponentHits
    if (!this.opponentField[row] || !this.opponentField[row][col]) {
      return false;
    }
    return this.opponentField[row][col] === 'H' || this.opponentField[row][col] === 'M';
  }

  private sendMove(row: number, col: number) {
    if (!this.gameIdNum || !this.playerId) return;

    const move = {
      gameId: this.gameIdNum,
      playerId: this.playerId,
      row: row,
      column: col
    };

    this.webSocketService.sendGameMove(move);
  }

  private sendGameActionWithData(actionType: string, data: any = {}) {
    if (!this.gameIdNum || !this.playerId) return;

    const action = {
      gameId: this.gameIdNum,
      playerId: this.playerId,
      actionType: actionType,
      ...data
    };

    this.webSocketService.sendGameAction(action);
  }

  /**
   * Проверка, является ли корабль потопленным
   */
  isShipSunk(row: number, col: number, isMyField: boolean): boolean {
    const field = isMyField ? this.myField : this.opponentField;
    const hits = isMyField ? this.myHits : this.opponentField;

    if (!field[row] || field[row][col] !== 'S') {
      return false;
    }
    return this.checkShipSunk(row, col, field, hits);
  }

  /**
   * Рекурсивная проверка потопления корабля
   */
  private checkShipSunk(row: number, col: number, field: string[][], hits: string[][]): boolean {
    const directions = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
    ];
    let isSunk = true;
    const visited = new Set<string>();

    const dfs = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (visited.has(key) || r < 0 || r >= 10 || c < 0 || c >= 10) return;
      visited.add(key);

      if (field[r][c] === 'S') {
        if (hits[r][c] !== 'H') {
          isSunk = false;
          return;
        }
        for (const dir of directions) {
          dfs(r + dir.r, c + dir.c);
        }
      }
    };

    dfs(row, col);
    return isSunk;
  }

  /**
   * Проверка валидности позиции
   */
  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < 10 && col >= 0 && col < 10;
  }

  /**
   * Обновление статистики
   */
  private updateStats(): void {
    if (!this.opponentField?.length) {
      this.myShotsCount = 0;
      this.myHitsCount = 0;
      return;
    }

    let shots = 0;
    let hits = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        const cell = this.opponentField[i]?.[j];
        if (cell === 'H' || cell === 'M') {
          shots++;
          if (cell === 'H') hits++;
        }
      }
    }

    this.myShotsCount = shots;
    this.myHitsCount = hits;
  }

  /**
   * Создание пустого поля
   */
  private createEmptyField(): number[][] {
    return Array(10).fill(0).map(() => Array(10).fill(0));
  }

  /**
   * Создание пустого поля попаданий
   */
  private createEmptyHitsField(): string[][] {
    return Array(10).fill(0).map(() => Array(10).fill(' '));
  }

  private subscribeToGameEnd() {
    console.log('Подписка на уведомления о завершении игры');
    const subscription = this.webSocketService.subscribeToGameEnd(
      this.playerId,
      (endNotification: any) => {
        console.log('Игра завершена:', endNotification);
        this.handleGameEnd(endNotification);
      }
    );

    if (subscription) {
      this.stompSubscriptions.push(subscription);
    }
  }

  private subscribeToErrors() {
    console.log('🔧 Подписка на уведомления об ошибках');
    const subscription = this.webSocketService.subscribeToErrors(
      this.playerId,
      (error: any) => {
        console.error('Ошибка игры:', error);
        this.showError(error.message || 'Произошла ошибка');
      }
    );

    if (subscription) {
      this.stompSubscriptions.push(subscription);
    }
  }

  private subscribeToDrawOffers() {
    console.log('🔧 Подписка на предложения ничьи');
    const subscription = this.webSocketService.subscribeToDrawOffers(
      this.playerId,
      (drawOffer: any) => {
        console.log('Получено предложение ничьи:', drawOffer);
        this.handleDrawOffer(drawOffer);
      }
    );

    if (subscription) {
      this.stompSubscriptions.push(subscription);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameState']) {
      this.updateStats();
    }
    if (changes['currentPlayerId'] && changes['currentPlayerId'].currentValue) {
      this.playerId = changes['currentPlayerId'].currentValue;
      console.log('🔄 Player ID обновлен через @Input:', this.playerId);
      // Переподписываемся при изменении playerId
      this.setupGameSubscriptions();
    }
  }

  ngOnDestroy() {
    // Отписываемся от RxJS подписок
    this.rxSubscriptions.forEach(sub => sub.unsubscribe());
    this.rxSubscriptions = [];

    // Отписываемся от Stomp подписок
    this.unsubscribeFromStompSubscriptions();
  }

  private unsubscribeFromStompSubscriptions() {
    this.stompSubscriptions.forEach(sub => {
      try {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      } catch (error) {
        console.warn('Ошибка при отписке от Stomp подписки:', error);
      }
    });
    this.stompSubscriptions = [];
  }

  // ==================== УПРАВЛЕНИЕ ИГРОЙ ====================
  offerDraw(): void {
    console.log('Предложение ничьи');
    this.showDrawPopup = true;
    this.sendGameActionWithData('OFFER_DRAW');
  }

  cancelDrawOffer(): void {
    console.log('Отмена предложения ничьи');
    this.showDrawPopup = false;
    this.sendGameActionWithData('CANCEL_DRAW');
  }

  closeDrawPopup(): void {
    this.showDrawPopup = false;
  }

  acceptDraw(): void {
    console.log('Принятие предложения ничьи');
    this.showDrawResponsePopup = false;
    this.sendGameActionWithData('ACCEPT_DRAW');
  }

  declineDraw(): void {
    console.log('Отклонение предложения ничьи');
    this.showDrawResponsePopup = false;
    this.sendGameActionWithData('DECLINE_DRAW');
  }

  surrender(): void {
    console.log('🏳️ Предложение сдаться');
    this.showSurrenderPopup = true;
  }

  confirmSurrender(): void {
    console.log('Подтверждение сдачи');
    this.showSurrenderPopup = false;
    this.sendGameActionWithData('SURRENDER');
  }

  cancelSurrender(): void {
    console.log('Отмена сдачи');
    this.showSurrenderPopup = false;
  }

  private handleGameEnd(endNotification: any) {
    console.log('🏁 Игра завершена с результатом:', endNotification.result);
    this.showGameResult(endNotification);
  }

  private handleDrawOffer(drawOffer: any) {
    this.showDrawResponsePopup = true;
    // Сохраняем данные о предложении
    const drawOfferData = {
      fromPlayerId: drawOffer.fromPlayerId,
      gameId: drawOffer.gameId,
      timestamp: new Date()
    };
    console.log('Предложение ничьи получено:', drawOfferData);
  }

  private showError(message: string) {
    console.error('Ошибка игры:', message);
    alert('Ошибка игры: ' + message);
  }

  private showGameResult(endNotification: any) {
    // Теперь это сработает, так как бэк пришлет winnerId как число
    if (endNotification.draw) {
      this.router.navigate(['/lobby']);
    } else if (endNotification.winnerId === this.playerId) {
      this.router.navigate(['/win']);
    } else {
      this.router.navigate(['/lose']);
    }
  }
}
