import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

interface GameState {
  myField: number[][];
  opponentField: number[][];
  myHits: boolean[][];
  opponentHits: boolean[][];
  myShips: number;
  opponentShips: number;
  isMyTurn: boolean;
}

@Component({
  selector: 'app-two-players-field-page',
  templateUrl: './two-players-field-page.component.html',
  styleUrls: ['./two-players-field-page.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class TwoPlayersFieldComponent implements OnChanges, OnInit {
  // Убираем статическое значение и делаем динамическим
  gameId: string = '';  // Теперь не @Input(), а локальная переменная

  @Input() myName: string = '';
  @Input() opponentName: string = '';

  // Инициализируем пустыми значениями, они будут обновляться через @Input()
  @Input() gameState: GameState = {
    myField: [],
    opponentField: [],
    myHits: [],
    opponentHits: [],
    myShips: 0,
    opponentShips: 0,
    isMyTurn: false
  };

  @Output() cellSelected = new EventEmitter<{ row: number; col: number }>();
  @Output() gameAction = new EventEmitter<{ type: string; data?: any }>();

  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Локальное состояние для UI
  showPausePopup = false;
  showDrawPopup = false;
  showDrawResponsePopup = false;
  showSurrenderPopup = false;

  // Статистика выстрелов
  myShotsCount = 0;
  myHitsCount = 0;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // Получаем gameId из параметров маршрута
    this.route.params.subscribe(params => {
      if (params['gameId']) {
        this.gameId = params['gameId'];
        console.log('Получен ID игры:', this.gameId);
      } else {
        // Если ID игры не передан, пробуем получить из queryParams или snapshot
        this.route.queryParams.subscribe(queryParams => {
          if (queryParams['gameId']) {
            this.gameId = queryParams['gameId'];
          } else {
            // Получаем из snapshot на всякий случай
            const snapshotId = this.route.snapshot.paramMap.get('gameId');
            if (snapshotId) {
              this.gameId = snapshotId;
            }
          }
        });
      }
    });

    // Также проверяем snapshot на случай быстрой навигации
    const snapshotId = this.route.snapshot.paramMap.get('gameId');
    if (snapshotId && !this.gameId) {
      this.gameId = snapshotId;
      console.log('Получен ID игры из snapshot:', this.gameId);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['gameState']) {
      this.updateStats();
    }
  }

  get isYourTurn(): boolean {
    return this.gameState?.isMyTurn ?? false;
  }

  get myShipsCount(): number {
    return this.gameState?.myShips ?? 0;
  }

  get opponentShipsCount(): number {
    return this.gameState?.opponentShips ?? 0;
  }

  get myField(): number[][] {
    return this.gameState?.myField && this.gameState.myField.length ?
      this.gameState.myField : this.createEmptyField();
  }

  get opponentField(): number[][] {
    return this.gameState?.opponentField && this.gameState.opponentField.length ?
      this.gameState.opponentField : this.createEmptyField();
  }

  get myHits(): boolean[][] {
    return this.gameState?.myHits && this.gameState.myHits.length ?
      this.gameState.myHits : this.createEmptyHitsField();
  }

  get opponentHits(): boolean[][] {
    return this.gameState?.opponentHits && this.gameState.opponentHits.length ?
      this.gameState.opponentHits : this.createEmptyHitsField();
  }

  /**
   * Обработка клика по клетке поля противника
   */
  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn ||
      !this.opponentHits[row] ||
      this.opponentHits[row][col]) {
      return; // Не ваш ход или уже стреляли в эту клетку
    }

    this.cellSelected.emit({ row, col });
  }

  /**
   * Проверка, является ли корабль потопленным
   */
  isShipSunk(row: number, col: number, isMyField: boolean): boolean {
    const field = isMyField ? this.myField : this.opponentField;
    const hits = isMyField ? this.myHits : this.opponentHits;

    if (!field[row] || field[row][col] !== 1 || !hits[row] || !hits[row][col]) {
      return false;
    }

    // Проверяем все клетки корабля
    return this.checkShipSunk(row, col, field, hits);
  }

  /**
   * Рекурсивная проверка потопления корабля
   */
  private checkShipSunk(row: number, col: number, field: number[][], hits: boolean[][]): boolean {
    const directions = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
    ];

    // Проверяем текущую клетку и все смежные клетки корабля
    let isSunk = true;
    const checked = new Set<string>();

    const checkCell = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (checked.has(key)) return;
      checked.add(key);

      if (field[r] && field[r][c] === 1) {
        if (!hits[r] || !hits[r][c]) {
          isSunk = false;
          return;
        }

        // Проверяем соседние клетки
        for (const dir of directions) {
          const newRow = r + dir.r;
          const newCol = c + dir.c;
          if (this.isValidPosition(newRow, newCol)) {
            checkCell(newRow, newCol);
          }
        }
      }
    };

    checkCell(row, col);
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
    if (!this.opponentHits.length) {
      this.myShotsCount = 0;
      this.myHitsCount = 0;
      return;
    }

    this.myShotsCount = this.opponentHits.flat().filter(hit => hit).length;
    this.myHitsCount = this.opponentHits.flat().filter((hit, index) => {
      const row = Math.floor(index / 10);
      const col = index % 10;
      return hit && this.opponentField[row] && this.opponentField[row][col] === 1;
    }).length;
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
  private createEmptyHitsField(): boolean[][] {
    return Array(10).fill(0).map(() => Array(10).fill(false));
  }

  // ==================== УПРАВЛЕНИЕ ИГРОЙ ====================
  /**
   * Предложение ничьи
   */
  offerDraw(): void {
    this.showDrawPopup = true;
    this.gameAction.emit({ type: 'OFFER_DRAW' });
  }

  /**
   * Отмена предложения ничьи
   */
  cancelDrawOffer(): void {
    this.showDrawPopup = false;
    this.gameAction.emit({ type: 'CANCEL_DRAW' });
  }

  /**
   * Закрытие попапа ничьи
   */
  closeDrawPopup(): void {
    this.showDrawPopup = false;
  }

  /**
   * Принятие ничьи
   */
  acceptDraw(): void {
    this.showDrawResponsePopup = false;
    this.gameAction.emit({ type: 'ACCEPT_DRAW' });
  }

  /**
   * Отклонение ничьи
   */
  declineDraw(): void {
    this.showDrawResponsePopup = false;
    this.gameAction.emit({ type: 'DECLINE_DRAW' });
  }

  /**
   * Сдача - открытие попапа подтверждения
   */
  surrender(): void {
    this.showSurrenderPopup = true;
  }

  /**
   * Подтверждение сдачи
   */
  confirmSurrender(): void {
    this.showSurrenderPopup = false;
    this.gameAction.emit({ type: 'SURRENDER' });
  }

  /**
   * Отмена сдачи
   */
  cancelSurrender(): void {
    this.showSurrenderPopup = false;
  }
}
