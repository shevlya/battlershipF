import { Component } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/webSocket.service';

/**
 * Интерфейс для представления корабля на игровом поле
 */
interface Ship {
  type: string;
  size: number;
  positions: { row: string; col: number }[];
  placed: boolean;
  id: number;
}

/**
 * Интерфейс для передачи данных о расстановке на сервер для игры с ИИ
 */
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

interface AIGameStartMessage {
  playerId: number;
  boardLayout: BoardLayoutDTO;
  gameType: string;
}

/**
 * Конфигурация типов кораблей и их количества
 */
const SHIP_TYPES = [
  { type: 'battleship', size: 4, count: 1 },
  { type: 'cruiser', size: 3, count: 2 },
  { type: 'destroyer', size: 2, count: 3 },
  { type: 'boat', size: 1, count: 4 }
];

/**
 * Размер игрового поля (10x10)
 */
const BOARD_SIZE = 10;

@Component({
  selector: 'app-ai-placement-page',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './ai-placement-page.component.html',
  styleUrl: './ai-placement-page.component.scss'
})
export class AiPlacementPageComponent {
  /** Буквенные обозначения строк игрового поля */
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];

  /** Числовые обозначения столбцов игрового поля */
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /** Текущая ориентация корабля */
  isHorizontal = true;

  /** Перетаскиваемый корабль */
  draggedShip: any = null;

  /** Ячейка над которой находится курсор при перетаскивании */
  hoveredCell: { row: string, col: number } | null = null;

  /** Потенциальные позиции для размещения корабля */
  potentialPositions: { row: string, col: number }[] = [];

  /** Флаги отображения всплывающих окон */
  showClearConfirmation = false;
  showStrategyPopup = false;

  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;

  /** Список кораблей для расстановки */
  ships: Ship[] = [
    { id: 1, type: 'battleship', size: 4, positions: [], placed: false },
    { id: 2, type: 'cruiser', size: 3, positions: [], placed: false },
    { id: 3, type: 'cruiser', size: 3, positions: [], placed: false },
    { id: 4, type: 'destroyer', size: 2, positions: [], placed: false },
    { id: 5, type: 'destroyer', size: 2, positions: [], placed: false },
    { id: 6, type: 'destroyer', size: 2, positions: [], placed: false },
    { id: 7, type: 'boat', size: 1, positions: [], placed: false },
    { id: 8, type: 'boat', size: 1, positions: [], placed: false },
    { id: 9, type: 'boat', size: 1, positions: [], placed: false },
    { id: 10, type: 'boat', size: 1, positions: [], placed: false }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.loadCurrentPlayer();
  }

  /**
   * Загрузка данных текущего пользователя из сервиса аутентификации
   */
  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь:', this.currentPlayer);

    if (!this.currentPlayer) {
      console.error('Пользователь не авторизован');
      alert('Вы не авторизованы. Пожалуйста, войдите в систему.');
      this.router.navigate(['/login']);
      return;
    }
  }

  // ==================== МЕТОДЫ УПРАВЛЕНИЯ ИГРОВЫМ ПОЛЕМ ====================

  /**
   * Запрос на очистку игрового поля с подтверждением
   */
  requestClearBoard() {
    if (!this.hasAtLeastOneShip()) {
      return;
    }
    this.showClearConfirmation = true;
  }

  /**
   * Подтверждение очистки игрового поля
   */
  confirmClear() {
    this.clearBoard();
    this.showClearConfirmation = false;
  }

  /**
   * Отмена очистки игрового поля
   */
  cancelClear() {
    this.showClearConfirmation = false;
  }

  /**
   * Переключение ориентации корабля
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
  }

  /**
   * Полная очистка игрового поля
   */
  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
  }

  /**
   * Генерация случайной расстановки всех кораблей
   */
  generateRandom() {
    this.clearBoard();

    const shipTypes = [...SHIP_TYPES];

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        this.placeShipRandomly(shipType.size, shipType.type);
      }
    }
  }

  /**
   * Запуск игры против ИИ
   */
  startAIGame() {
    if (this.isAllShipsPlaced()) {
      console.log('Начало игры с ИИ');

      // Конвертируем расстановку в формат для сервера
      const boardLayout = this.convertToBoardLayoutDTO();

      // Подготавливаем сообщение для сервера
      const aiGameMessage: AIGameStartMessage = {
        playerId: this.currentPlayer.player_id,
        boardLayout: boardLayout,
        gameType: 'SINGLEPLAYER'
      };

      console.log('Отправка расстановки для игры с ИИ:', aiGameMessage);

      // В реальном приложении здесь был бы вызов API
      // Для демо просто переходим на страницу игры с ИИ
      this.navigateToAIGame(boardLayout);
    } else {
      alert('Разместите все корабли перед началом игры!');
    }
  }

  /**
   * Переход на страницу игры с ИИ
   */
  private navigateToAIGame(boardLayout: BoardLayoutDTO) {
    // Сохраняем расстановку в sessionStorage для передачи на следующую страницу
    sessionStorage.setItem('aiGameBoardLayout', JSON.stringify(boardLayout));
    sessionStorage.setItem('currentPlayerId', this.currentPlayer.player_id.toString());

    // Переход на страницу игры с ИИ
    this.router.navigate(['/single-player-game']);
  }

  // ==================== МЕТОДЫ DRAG & DROP ====================

  /**
   * Обработчик начала перетаскивания корабля
   */
  onDragStart(event: DragEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('draggable')) {
      this.draggedShip = {
        size: parseInt(target.getAttribute('data-size') || '1'),
        type: target.getAttribute('data-type') || 'boat'
      };
      event.dataTransfer?.setData('text/plain', 'ship');
    }
  }

  /**
   * Обработчик перемещения корабля над игровым полем
   */
  onDragOver(event: DragEvent) {
    event.preventDefault();

    const target = event.target as HTMLElement;
    if (target.classList.contains('cell')) {
      const row = target.getAttribute('data-row');
      const col = parseInt(target.getAttribute('data-col') || '0');

      if (row) {
        this.hoveredCell = { row, col };

        if (this.draggedShip) {
          this.potentialPositions = this.getShipPositions(this.draggedShip.size, row, col);
        }
      }
    }
  }

  /**
   * Обработчик выхода курсора за пределы игрового поля при перетаскивании
   */
  onDragLeave(event: DragEvent) {
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  /**
   * Обработчик завершения перетаскивания - размещение корабля на поле
   */
  onDrop(event: DragEvent) {
    event.preventDefault();

    if (!this.draggedShip || !this.hoveredCell) return;

    const { row, col } = this.hoveredCell;

    if (this.canPlaceShip(this.draggedShip, row, col)) {
      this.placeShip(this.draggedShip, row, col);
    }

    this.draggedShip = null;
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  // ==================== МЕТОДЫ ПРОВЕРКИ И ВАЛИДАЦИИ ====================

  /**
   * Проверка, что на поле размещен хотя бы один корабль
   */
  hasAtLeastOneShip(): boolean {
    return this.ships.some(ship => ship.placed && ship.positions.length > 0);
  }

  /**
   * Получение количества оставшихся для размещения кораблей определенного типа
   */
  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  /**
   * Проверка, что все корабли размещены на поле
   */
  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  /**
   * Проверка валидности позиции на игровом поле
   */
  isValidPosition(row: string, col: number): boolean {
    const rowIndex = this.rows.indexOf(row);
    return rowIndex >= 0 && rowIndex < this.rows.length &&
      col >= 1 && col <= this.columns.length;
  }

  /**
   * Проверка наличия корабля в указанной позиции
   */
  hasShip(row: string, col: number): boolean {
    return this.ships.some(ship =>
      ship.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

  /**
   * Проверка наличия соседнего корабля в смежных клетках
   */
  hasAdjacentShip(row: string, col: number): boolean {
    const directions = [
      { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 },
      { r: -1, c: -1 }, { r: -1, c: 1 }, { r: 1, c: -1 }, { r: 1, c: 1 }
    ];

    for (const dir of directions) {
      const newRowIndex = this.rows.indexOf(row) + dir.r;
      const newCol = col + dir.c;

      if (newRowIndex >= 0 && newRowIndex < this.rows.length &&
        newCol >= 1 && newCol <= this.columns.length) {
        const adjacentRow = this.rows[newRowIndex];
        if (this.hasShip(adjacentRow, newCol)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Проверка возможности размещения корабля в указанной позиции
   */
  canPlaceShip(ship: any, startRow: string, startCol: number): boolean {
    const positions = this.getShipPositions(ship.size, startRow, startCol);

    for (const pos of positions) {
      if (!this.isValidPosition(pos.row, pos.col)) {
        return false;
      }
    }

    for (const pos of positions) {
      if (this.hasShip(pos.row, pos.col)) {
        return false;
      }

      if (this.hasAdjacentShip(pos.row, pos.col)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Проверка является ли ячейка валидной зоной для размещения корабля
   */
  isValidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  /**
   * Проверка является ли ячейка невалидной зоной для размещения корабля
   */
  isInvalidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      !this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  // ==================== МЕТОДЫ РАСЧЕТА ПОЗИЦИЙ ====================

  /**
   * Расчет всех позиций корабля исходя из начальной точки и ориентации
   */
  getShipPositions(size: number, startRow: string, startCol: number): { row: string, col: number }[] {
    const positions = [];
    const startRowIndex = this.rows.indexOf(startRow);

    if (this.isHorizontal) {
      const shouldFlip = this.shouldFlipHorizontal(startCol, size);

      if (shouldFlip) {
        for (let i = 0; i < size; i++) {
          positions.push({
            row: startRow,
            col: startCol + i
          });
        }
      } else {
        for (let i = 0; i < size; i++) {
          positions.push({
            row: startRow,
            col: startCol - i
          });
        }
      }
    } else {
      const shouldFlip = this.shouldFlipVertical(startRowIndex, size);

      if (shouldFlip) {
        for (let i = 0; i < size; i++) {
          if (startRowIndex + i < this.rows.length) {
            positions.push({
              row: this.rows[startRowIndex + i],
              col: startCol
            });
          }
        }
      } else {
        for (let i = 0; i < size; i++) {
          if (startRowIndex - i >= 0) {
            positions.push({
              row: this.rows[startRowIndex - i],
              col: startCol
            });
          }
        }
      }
    }

    return positions;
  }

  /**
   * Определение направления размещения для горизонтальной ориентации
   */
  shouldFlipHorizontal(startCol: number, size: number): boolean {
    if (startCol <= size) {
      return true;
    }
    if (startCol >= this.columns.length - size + 1) {
      return false;
    }
    return true;
  }

  /**
   * Определение направления размещения для вертикальной ориентации
   */
  shouldFlipVertical(startRowIndex: number, size: number): boolean {
    if (startRowIndex < size) {
      return true;
    }
    if (startRowIndex >= this.rows.length - size) {
      return false;
    }
    return true;
  }

  // ==================== МЕТОДЫ РАЗМЕЩЕНИЯ КОРАБЛЕЙ ====================

  /**
   * Размещение корабля на игровом поле
   */
  placeShip(ship: any, startRow: string, startCol: number) {
    const positions = this.getShipPositions(ship.size, startRow, startCol);

    const availableShip = this.ships.find(s =>
      s.type === ship.type && !s.placed
    );

    if (availableShip) {
      availableShip.positions = positions;
      availableShip.placed = true;
    }
  }

  /**
   * Случайное размещение корабля на поле
   */
  placeShipRandomly(size: number, type: string) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      const randomRow = this.rows[Math.floor(Math.random() * this.rows.length)];
      const randomCol = this.columns[Math.floor(Math.random() * this.columns.length)];
      const randomOrientation = Math.random() > 0.5;

      const currentOrientation = this.isHorizontal;
      this.isHorizontal = randomOrientation;

      if (this.canPlaceShip({ size, type }, randomRow, randomCol)) {
        this.placeShip({ size, type }, randomRow, randomCol);
        placed = true;
      }

      this.isHorizontal = currentOrientation;
      attempts++;
    }
  }

  // ==================== МЕТОДЫ ПРЕОБРАЗОВАНИЯ ДАННЫХ ====================

  /**
   * Конвертация текущей расстановки в формат для отправки на сервер
   */
  private convertToServerFormat(): ShipPlacement[] {
    const serverPlacements: ShipPlacement[] = [];

    this.ships.forEach(ship => {
      if (ship.placed && ship.positions.length > 0) {
        const firstPosition = ship.positions[0];
        const lastPosition = ship.positions[ship.positions.length - 1];

        const row = this.rows.indexOf(firstPosition.row);
        const col = firstPosition.col - 1;

        const vertical = firstPosition.row !== lastPosition.row;

        serverPlacements.push({
          shipId: ship.id,
          size: ship.size,
          row: row,
          col: col,
          vertical: vertical
        });
      }
    });

    return serverPlacements;
  }

  /**
   * Метод для конвертации расстановки в формат BoardLayoutDTO
   */
  private convertToBoardLayoutDTO(): BoardLayoutDTO {
    const matrix: string[][] = Array(10).fill(null).map(() => Array(10).fill(' '));

    this.ships.forEach(ship => {
      if (ship.placed) {
        ship.positions.forEach(pos => {
          const rowIndex = this.rows.indexOf(pos.row);
          const colIndex = pos.col - 1;

          if (rowIndex >= 0 && rowIndex < 10 && colIndex >= 0 && colIndex < 10) {
            matrix[rowIndex][colIndex] = 'S';
          }
        });
      }
    });

    const ships = this.convertToServerFormat();

    return {
      ships: ships,
      matrix: matrix
    };
  }

  // ==================== СТРАТЕГИИ АВТОМАТИЧЕСКОЙ РАССТАНОВКИ ====================

  /**
   * Открытие попапа выбора стратегии
   */
  openStrategyPopup() {
    this.showStrategyPopup = true;
  }

  /**
   * Закрытие попапа выбора стратегии
   */
  closeStrategyPopup() {
    this.showStrategyPopup = false;
  }

  /**
   * Загрузка стратегии автоматической расстановки кораблей
   */
  loadStrategy(strategy: string) {
    this.clearBoard();

    switch (strategy) {
      case 'coastal':
        this.placeShipsCoastal();
        break;
      case 'diagonal':
        this.placeShipsDiagonal();
        break;
      case 'halfField':
        this.placeShipsHalfField();
        break;
      case 'spread':
        this.placeShipsSpread();
        break;
    }

    this.closeStrategyPopup();
    console.log(`Загружена стратегия: ${strategy}`);
  }

  /**
   * Береговая стратегия - размещение кораблей вдоль границ поля
   */
  private placeShipsCoastal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          const isBorder = Math.random() > 0.1;
          let row = '', col = 0;

          if (isBorder) {
            const side = Math.floor(Math.random() * 4);
            switch(side) {
              case 0:
                row = this.rows[0];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 1:
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = BOARD_SIZE;
                break;
              case 2:
                row = this.rows[BOARD_SIZE - 1];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 3:
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = 1;
                break;
            }
          } else {
            const borderZone = 2;
            const randomBorder = Math.floor(Math.random() * 4);
            switch(randomBorder) {
              case 0:
                row = this.rows[Math.floor(Math.random() * borderZone)];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 1:
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = BOARD_SIZE - Math.floor(Math.random() * borderZone);
                break;
              case 2:
                row = this.rows[BOARD_SIZE - 1 - Math.floor(Math.random() * borderZone)];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 3:
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = 1 + Math.floor(Math.random() * borderZone);
                break;
            }
          }

          const orientation = shipType.size > 1 ? (Math.random() > 0.5 ? 'horizontal' : 'vertical') : 'horizontal';
          const currentOrientation = this.isHorizontal;
          this.isHorizontal = orientation === 'horizontal';

          if (this.canPlaceShip({ size: shipType.size, type: shipType.type }, row, col)) {
            this.placeShip({ size: shipType.size, type: shipType.type }, row, col);
            placed = true;
          }

          this.isHorizontal = currentOrientation;
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size, shipType.type);
        }
      }
    }
  }

  /**
   * Диагональная стратегия - размещение кораблей вдоль диагоналей поля
   */
  private placeShipsDiagonal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    const useMainDiagonal = Math.random() > 0.5;

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          let row = '', col = 0;
          let rowIndex = 0;

          if (useMainDiagonal) {
            rowIndex = Math.floor(Math.random() * (BOARD_SIZE - shipType.size + 1));
            const diagonalOffset = Math.floor(Math.random() * 3) - 1;
            row = this.rows[rowIndex];
            col = rowIndex + 1 + diagonalOffset;
          } else {
            rowIndex = Math.floor(Math.random() * (BOARD_SIZE - shipType.size + 1));
            const diagonalOffset = Math.floor(Math.random() * 3) - 1;
            row = this.rows[rowIndex];
            col = BOARD_SIZE - rowIndex + diagonalOffset;
          }

          col = Math.max(1, Math.min(BOARD_SIZE, col));

          const orientation = Math.random() > 0.7 ? 'horizontal' : 'vertical';
          const currentOrientation = this.isHorizontal;
          this.isHorizontal = orientation === 'horizontal';

          if (this.canPlaceShip({ size: shipType.size, type: shipType.type }, row, col)) {
            this.placeShip({ size: shipType.size, type: shipType.type }, row, col);
            placed = true;
          }

          this.isHorizontal = currentOrientation;
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size, shipType.type);
        }
      }
    }
  }

  /**
   * Полупольная стратегия - размещение кораблей в одной половине поля
   */
  private placeShipsHalfField(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    const isVerticalSplit = Math.random() > 0.5;
    const half = Math.random() > 0.5 ? 'first' : 'second';

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          let row = '', col = 0;

          if (isVerticalSplit) {
            if (half === 'first') {
              row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
              col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + 1;
            } else {
              row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
              col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + Math.floor(BOARD_SIZE / 2) + 1;
            }
          } else {
            if (half === 'first') {
              row = this.rows[Math.floor(Math.random() * (BOARD_SIZE / 2))];
              col = Math.floor(Math.random() * BOARD_SIZE) + 1;
            } else {
              row = this.rows[Math.floor(Math.random() * (BOARD_SIZE / 2)) + Math.floor(BOARD_SIZE / 2)];
              col = Math.floor(Math.random() * BOARD_SIZE) + 1;
            }
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
          const currentOrientation = this.isHorizontal;
          this.isHorizontal = orientation === 'horizontal';

          if (this.canPlaceShip({ size: shipType.size, type: shipType.type }, row, col)) {
            this.placeShip({ size: shipType.size, type: shipType.type }, row, col);
            placed = true;
          }

          this.isHorizontal = currentOrientation;
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size, shipType.type);
        }
      }
    }
  }

  /**
   * Стратегия разброса - равномерное размещение кораблей по всему полю
   */
  private placeShipsSpread(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          let row = '', col = 0;
          let isValidPosition = false;

          while (!isValidPosition && attempts < 100) {
            row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
            col = Math.floor(Math.random() * BOARD_SIZE) + 1;

            const rowIndex = this.rows.indexOf(row);
            const isBorder = rowIndex === 0 || rowIndex === BOARD_SIZE - 1 || col === 1 || col === BOARD_SIZE;
            const isCenter = rowIndex >= 3 && rowIndex <= 6 && col >= 4 && col <= 7;
            const isDiagonal = rowIndex === col - 1 || rowIndex + col - 1 === BOARD_SIZE - 1;

            isValidPosition = !isBorder && !isCenter && !isDiagonal;
            if (Math.random() > 0.2) {
              isValidPosition = true;
            }

            attempts++;
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
          const currentOrientation = this.isHorizontal;
          this.isHorizontal = orientation === 'horizontal';

          if (this.canPlaceShip({ size: shipType.size, type: shipType.type }, row, col)) {
            this.placeShip({ size: shipType.size, type: shipType.type }, row, col);
            placed = true;
          }

          this.isHorizontal = currentOrientation;
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size, shipType.type);
        }
      }
    }
  }
}
