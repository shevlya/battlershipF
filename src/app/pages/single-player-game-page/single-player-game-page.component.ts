import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface GameState {
  gameId: number;
  playerId: number;
  playerField: string[][];
  opponentField: string[][];
  playerHits: string[][];
  opponentHits: string[][];
  playerShipsLeft: number;
  opponentShipsLeft: number;
  playerTurn: boolean;
  gameOver: boolean;
  winner: string;
  lastAIShot?: number[];
  lastAIShotHit?: boolean;
  message?: string;
}

interface ShipPlacement {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

interface BoardLayoutDTO {
  ships: ShipPlacement[];
  matrix: string[][];
}

@Component({
  selector: 'app-single-player-game-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './single-player-game-page.component.html',
  styleUrls: ['./single-player-game-page.component.scss']
})
export class SinglePlayerGamePageComponent implements OnInit, OnDestroy {
  // Конфигурация поля
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Состояние игры
  gameId: number | null = null;
  playerId: number = 0;
  gameState: GameState = {
    gameId: 0,
    playerId: 0,
    playerField: this.createEmptyStringField(),
    opponentField: this.createEmptyStringField(),
    playerHits: this.createEmptyStringField(),
    opponentHits: this.createEmptyStringField(),
    playerShipsLeft: 0,
    opponentShipsLeft: 0,
    playerTurn: false,
    gameOver: false,
    winner: ''
  };

  // Статистика
  myShotsCount: number = 0;
  myHitsCount: number = 0;

  // UI состояния
  showSurrenderPopup: boolean = false;
  showGameOverPopup: boolean = false;
  gameOverMessage: string = '';

  // Таймер для автоматических действий
  private aiThinkingTimer: any = null;
  private aiTurnDelay: number = 1000; // 1 секунда на "раздумья" ИИ

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadGameFromStorage();
  }

  ngOnDestroy(): void {
    if (this.aiThinkingTimer) {
      clearTimeout(this.aiThinkingTimer);
    }
  }

  /**
   * Загрузка игры из sessionStorage
   */
  private loadGameFromStorage(): void {
    try {
      // Получаем данные из sessionStorage
      const boardLayoutStr = sessionStorage.getItem('aiGameBoardLayout');
      const playerIdStr = sessionStorage.getItem('currentPlayerId');

      if (!boardLayoutStr || !playerIdStr) {
        console.error('Данные игры не найдены в sessionStorage');
        this.router.navigate(['/ai-placement']);
        return;
      }

      // Парсим данные
      const boardLayout: BoardLayoutDTO = JSON.parse(boardLayoutStr);
      this.playerId = parseInt(playerIdStr, 10);

      console.log('Загружены данные игры:', {
        playerId: this.playerId,
        boardLayout
      });

      // Создаем новую игру на бэкенде
      this.createAIGame(boardLayout);

    } catch (error) {
      console.error('Ошибка при загрузке игры:', error);
      this.router.navigate(['/ai-placement']);
    }
  }

  /**
   * Создание новой игры с ИИ на бэкенде
   */
  private createAIGame(boardLayout: BoardLayoutDTO): void {
    const apiUrl = 'http://localhost:8080/api/ai/game/create';

    const requestBody = {
      playerId: this.playerId,
      boardLayout: boardLayout,
      gameType: 'SINGLEPLAYER'
    };

    console.log('Отправка запроса на создание игры:', requestBody);

    this.http.post<GameState>(apiUrl, requestBody).subscribe({
      next: (response) => {
        console.log('Игра создана успешно:', response);

        this.gameId = response.gameId;
        this.updateGameState(response);

        // Сохраняем gameId в sessionStorage
        sessionStorage.setItem('currentGameId', response.gameId.toString());
      },
      error: (error) => {
        console.error('Ошибка при создании игры:', error);
        alert('Не удалось создать игру. Попробуйте снова.');
        this.router.navigate(['/ai-placement']);
      }
    });
  }

  /**
   * Выстрел игрока по полю ИИ
   */
  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn ||
      this.gameState.gameOver ||
      this.gameState.opponentField[row]?.[col] !== ' ') {
      return;
    }

    this.makeMove(row, col);
  }

  /**
   * Отправка хода на сервер
   */
  private makeMove(row: number, col: number): void {
    if (!this.gameId || !this.playerId) return;

    const apiUrl = `http://localhost:8080/api/ai/game/${this.gameId}/move`;

    const requestBody = {
      playerId: this.playerId,
      row: row,
      col: col
    };

    console.log('Отправка хода:', requestBody);

    this.http.post<GameState>(apiUrl, requestBody).subscribe({
      next: (response) => {
        console.log('Ход обработан:', response);

        this.updateGameState(response);

        // Если игра не окончена и следующий ход ИИ
        if (!response.gameOver && !response.playerTurn) {
          // ИИ делает ход автоматически через задержку
          this.scheduleAITurn();
        }
      },
      error: (error) => {
        console.error('Ошибка при выполнении хода:', error);
        alert('Не удалось выполнить ход. Попробуйте снова.');
      }
    });
  }

  /**
   * Запланировать ход ИИ через задержку
   */
  private scheduleAITurn(): void {
    if (this.aiThinkingTimer) {
      clearTimeout(this.aiThinkingTimer);
    }

    this.aiThinkingTimer = setTimeout(() => {
      this.makeAIMove();
    }, this.aiTurnDelay);
  }

  /**
   * ИИ делает ход (симуляция или запрос к серверу)
   */
  private makeAIMove(): void {
    if (!this.gameId || !this.playerId) return;

    // Для ИИ ход уже сделан на сервере, нужно просто получить обновленное состояние
    this.getGameState();
  }

  /**
   * Получение текущего состояния игры
   */
  private getGameState(): void {
    if (!this.gameId || !this.playerId) return;

    const apiUrl = `http://localhost:8080/api/ai/game/${this.gameId}/state`;
    const params = { playerId: this.playerId.toString() };

    this.http.get<GameState>(apiUrl, { params }).subscribe({
      next: (response) => {
        this.updateGameState(response);

        // Если игра не окончена и снова ход ИИ
        if (!response.gameOver && !response.playerTurn) {
          this.scheduleAITurn();
        }
      },
      error: (error) => {
        console.error('Ошибка при получении состояния:', error);
      }
    });
  }

  /**
   * Обновление состояния игры
   */
  private updateGameState(state: GameState): void {
    this.gameState = {
      ...this.gameState,
      ...state
    };

    // Обновляем статистику
    this.updateStats();

    // Проверяем, окончена ли игра
    if (state.gameOver) {
      this.showGameOver(state.winner);
    }
  }

  /**
   * Обновление статистики выстрелов
   */
  private updateStats(): void {
    let shots = 0;
    let hits = 0;

    // Считаем выстрелы по полю противника
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        const cell = this.gameState.opponentField[i]?.[j];
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
  private createEmptyStringField(): string[][] {
    return Array(10).fill(null).map(() => Array(10).fill(' '));
  }

  // ==================== ГЕТТЕРЫ ДЛЯ ШАБЛОНА ====================

  get isYourTurn(): boolean {
    return this.gameState.playerTurn && !this.gameState.gameOver;
  }

  get myShipsCount(): number {
    return this.gameState.playerShipsLeft;
  }

  get opponentShipsCount(): number {
    return this.gameState.opponentShipsLeft;
  }

  get myField(): string[][] {
    return this.gameState.playerField || this.createEmptyStringField();
  }

  get opponentField(): string[][] {
    return this.gameState.opponentField || this.createEmptyStringField();
  }

  get myHits(): string[][] {
    return this.gameState.opponentHits || this.createEmptyStringField();
  }

  // ==================== ЛОГИКА ИГРЫ ====================

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
   * Показать окно завершения игры
   */
  private showGameOver(winner: string): void {
    if (winner === 'PLAYER') {
      this.gameOverMessage = 'Поздравляем! Вы победили компьютер!';
    } else if (winner === 'COMPUTER') {
      this.gameOverMessage = 'Вы проиграли. Компьютер оказался сильнее.';
    } else {
      this.gameOverMessage = 'Игра завершена.';
    }

    this.showGameOverPopup = true;
  }

  /**
   * Закрыть окно завершения игры и вернуться в меню
   */
  closeGameOverPopup(): void {
    this.showGameOverPopup = false;
    this.router.navigate(['/main-menu']);
  }

  /**
   * Предложение сдачи
   */
  surrender(): void {
    this.showSurrenderPopup = true;
  }

  /**
   * Подтверждение сдачи
   */
  confirmSurrender(): void {
    if (!this.gameId || !this.playerId) {
      this.router.navigate(['/main-menu']);
      return;
    }

    const apiUrl = `http://localhost:8080/api/ai/game/${this.gameId}/surrender`;
    const params = { playerId: this.playerId.toString() };

    this.http.post(apiUrl, null, { params }).subscribe({
      next: () => {
        this.showSurrenderPopup = false;
        this.gameOverMessage = 'Вы сдались. Компьютер победил.';
        this.showGameOverPopup = true;
      },
      error: (error) => {
        console.error('Ошибка при сдаче:', error);
        alert('Не удалось сдаться. Попробуйте снова.');
      }
    });
  }

  /**
   * Отмена сдачи
   */
  cancelSurrender(): void {
    this.showSurrenderPopup = false;
  }

  /**
   * Заглушка для предложения ничьи (в игре с ИИ не используется)
   */
  offerDraw(): void {
    alert('В игре с компьютером ничья невозможна.');
  }

  /**
   * Заглушка для закрытия попапа ничьи
   */
  closeDrawPopup(): void {
    // Не используется в игре с ИИ
  }

  /**
   * Заглушка для отмены предложения ничьи
   */
  cancelDrawOffer(): void {
    // Не используется в игре с ИИ
  }

  /**
   * Заглушка для принятия ничьи
   */
  acceptDraw(): void {
    // Не используется в игре с ИИ
  }

  /**
   * Заглушка для отклонения ничьи
   */
  declineDraw(): void {
    // Не используется в игре с ИИ
  }
}
