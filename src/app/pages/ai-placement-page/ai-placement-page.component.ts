import { Component } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
 * Интерфейс для сохранения пользовательской расстановки кораблей
 */
interface UserPlacement {
  id: number;
  name: string;
  date: Date;
  ships: Ship[];
}

/**
 * Интерфейс для передачи данных о расстановке на сервер (для одиночной игры)
 */
interface ShipPlacement {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

/**
 * Конфигурация типов кораблей и их количества
 */
const SHIP_TYPES = [
  { type: 'battleship', size: 4, count: 1 },   // 1 линкор (4 клетки)
  { type: 'cruiser', size: 3, count: 2 },      // 2 крейсера (3 клетки)
  { type: 'destroyer', size: 2, count: 3 },    // 3 эсминца (2 клетки)
  { type: 'boat', size: 1, count: 4 }          // 4 катера (1 клетка)
];

/**
 * Размер игрового поля (10x10)
 */
const BOARD_SIZE = 10;

/**
 * Уровни сложности ИИ
 */
enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

/**
 * Компонент для расстановки кораблей перед началом одиночной игры в морской бой
 *
 * Основные функции:
 * - Drag & Drop расстановка кораблей
 * - Сохранение/загрузка пользовательских расстановок
 * - Автоматическая расстановка по различным стратегиям
 * - Выбор уровня сложности ИИ
 * - Валидация правильности расстановки
 *
 * @component
 * @selector app-ai-placement-page
 */
@Component({
  selector: 'app-ai-placement-page',
  standalone: true,
  imports: [DatePipe, FormsModule, CommonModule],
  templateUrl: './ai-placement-page.component.html',
  styleUrl: './ai-placement-page.component.scss'
})
export class AiPlacementPageComponent {
  /** Буквенные обозначения строк игрового поля */
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];

  /** Числовые обозначения столбцов игрового поля */
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /** Текущая ориентация корабля (горизонтальная/вертикальная) */
  isHorizontal = true;

  /** Перетаскиваемый корабль */
  draggedShip: any = null;

  /** Ячейка над которой находится курсор при перетаскивании */
  hoveredCell: { row: string, col: number } | null = null;

  /** Потенциальные позиции для размещения корабля */
  potentialPositions: { row: string, col: number }[] = [];

  /** Флаги отображения всплывающих окон */
  showLoadPopup = false;
  showSavePopup = false;
  showClearConfirmation = false;
  showDifficultyPopup = false;
  showMessagePopup = false;

  /** Данные для попапа сообщения */
  messageTitle = '';
  messageText = '';

  /** Название новой сохраняемой расстановки */
  newPlacementName: string = '';

  /** Список сохраненных пользовательских расстановок */
  userPlacements: UserPlacement[] = [];
  /** Список доступных стратегий расстановки */
  strategies = [
    {
      id: 'coastal',
      name: 'Береговая стратегия',
      description: 'Размещение кораблей вдоль границ поля'
    },
    {
      id: 'diagonal',
      name: 'Диагональная стратегия',
      description: 'Размещение кораблей по диагоналям'
    },
    {
      id: 'halfField',
      name: 'Полупольная стратегия',
      description: 'Корабли размещаются в одной половине поля'
    },
    {
      id: 'spread',
      name: 'Разбросанная стратегия',
      description: 'Корабли размещаются равномерно по всему полю'
    }
  ];
  /** Выбранный уровень сложности */
  selectedDifficulty: DifficultyLevel = DifficultyLevel.MEDIUM;

  /** Доступные уровни сложности */
  difficultyLevels = [
    { value: DifficultyLevel.EASY, label: 'Легкий', description: 'ИИ стреляет случайно' },
    { value: DifficultyLevel.MEDIUM, label: 'Средний', description: 'ИИ использует базовую логику' },
    { value: DifficultyLevel.HARD, label: 'Сложный', description: 'ИИ использует продвинутые алгоритмы' }
  ];

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

  /** Флаг готовности игрока */
  isPlayerReady = false;

  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;

  /**
   * Геттер для получения ID текущего пользователя
   */
  private get userId(): string {
    if (this.currentPlayer && this.currentPlayer.player_id) {
      return this.currentPlayer.player_id;
    }
    return 'unknown_user';
  }

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Инициализация компонента
   */
  ngOnInit() {
    this.loadCurrentPlayer();
  }

  /**
   * Загрузка данных текущего пользователя
   */
  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь:', this.currentPlayer);

    if (!this.currentPlayer) {
      console.error('Пользователь не авторизован');
      this.showMessage('Ошибка авторизации', 'Вы не авторизованы. Пожалуйста, войдите в систему.', false);
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
      return;
    }

    this.loadUserPlacements();
  }

  // ==================== МЕТОДЫ УПРАВЛЕНИЯ ИГРОВЫМ ПОЛЕМ ====================

  /**
   * Запрос на очистку игрового поля
   */
  requestClearBoard() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Ошибка', 'На поле нет кораблей для очистки', true);
      return;
    }
    this.showClearConfirmation = true;
  }

  /**
   * Подтверждение очистки поля
   */
  confirmClear() {
    this.clearBoard();
    this.showClearConfirmation = false;
    this.showMessage('Поле очищено', 'Все корабли были удалены с поля', true);
  }

  /**
   * Отмена очистки поля
   */
  cancelClear() {
    this.showClearConfirmation = false;
  }

  /**
   * Переключение ориентации корабля
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
    const orientation = this.isHorizontal ? 'горизонтально' : 'вертикально';
    this.showMessage('Ориентация изменена', `Корабли теперь размещаются ${orientation}`, true);
  }

  /**
   * Очистка игрового поля
   */
  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
    this.isPlayerReady = false;
  }

  /**
   * Генерация случайной расстановки
   */
  generateRandom() {
    this.clearBoard();

    const shipTypes = [...SHIP_TYPES];

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        this.placeShipRandomly(shipType.size, shipType.type);
      }
    }

    this.showMessage('Случайная расстановка', 'Все корабли были размещены случайным образом', true);
  }

  /**
   * Получение читаемого названия типа корабля
   */
  getShipTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      'battleship': 'Линкор',
      'cruiser': 'Крейсер',
      'destroyer': 'Эсминец',
      'boat': 'Катер'
    };
    return typeNames[type] || type;
  }

  /**
   * Получение общего количества оставшихся кораблей
   */
  getTotalRemainingShipsCount(): number {
    return this.ships.filter(ship => !ship.placed).length;
  }

  /**
   * Получение названия уровня сложности
   */
  getDifficultyLabel(level: DifficultyLevel): string {
    const levelObj = this.difficultyLevels.find(d => d.value === level);
    return levelObj ? levelObj.label : 'Средний';
  }

  /**
   * Показать попап выбора сложности
   */
  showDifficultySelection() {
    this.showDifficultyPopup = true;
  }

  /**
   * Закрыть попап выбора сложности
   */
  closeDifficultyPopup() {
    this.showDifficultyPopup = false;
  }

  /**
   * Изменить уровень сложности
   */
  changeDifficulty(level: DifficultyLevel) {
    this.selectedDifficulty = level;
    this.showDifficultyPopup = false;
    const levelName = this.difficultyLevels.find(d => d.value === level)?.label || 'Средний';
    this.showMessage('Уровень сложности изменен', `Установлен уровень: ${levelName}`, true);
  }

  /**
   * Готовность к игре
   */
  playerReady() {
    if (!this.isAllShipsPlaced()) {
      this.showMessage('Не все корабли размещены', 'Разместите все корабли перед началом игры!', false);
      return;
    }

    // Сохраняем ID игрока для следующей страницы
    const playerId = this.currentPlayer.player_id;
    if (playerId) {
      localStorage.setItem('playerId', playerId.toString());
    }

    // Сохраняем уровень сложности
    localStorage.setItem('aiDifficulty', this.selectedDifficulty);

    // Конвертируем расстановку для передачи
    const playerPlacement = this.convertToServerFormat();

    // Генерируем расстановку для ИИ
    const aiPlacement = this.generateAIPlacement();

    // Сохраняем данные для игры
    const gameData = {
      playerId: playerId,
      playerShips: playerPlacement,
      aiShips: aiPlacement,
      difficulty: this.selectedDifficulty,
      gameType: 'SINGLE_PLAYER'
    };

    localStorage.setItem('aiGameData', JSON.stringify(gameData));

    this.isPlayerReady = true;
    this.showMessage('Готов к игре!', `Уровень сложности: ${this.selectedDifficulty}. Нажмите "Начать игру", чтобы начать сражение с ИИ.`, false);
  }

  /**
   * Начать игру с ИИ
   */
  startGameWithAI() {
    if (!this.isPlayerReady) {
      this.showMessage('Не готовы к игре', 'Сначала нажмите "Готов к игре"', false);

      return;
    }

    // Переход на страницу игры с ИИ
    this.router.navigate(['/single-game'], {
      queryParams: {
        difficulty: this.selectedDifficulty
      }
    });
  }

  /**
   * Отмена готовности
   */
  cancelReady() {
    this.isPlayerReady = false;
    this.showMessage('Готовность отменена', 'Вы можете изменить расстановку кораблей или уровень сложности', true);
  }

  // ==================== МЕТОДЫ ГЕНЕРАЦИИ ПОЛЯ ИИ ====================

  /**
   * Генерация расстановки для ИИ в зависимости от уровня сложности
   */
  private generateAIPlacement(): ShipPlacement[] {
    const aiShips: Ship[] = [
      { id: 101, type: 'battleship', size: 4, positions: [], placed: false },
      { id: 102, type: 'cruiser', size: 3, positions: [], placed: false },
      { id: 103, type: 'cruiser', size: 3, positions: [], placed: false },
      { id: 104, type: 'destroyer', size: 2, positions: [], placed: false },
      { id: 105, type: 'destroyer', size: 2, positions: [], placed: false },
      { id: 106, type: 'destroyer', size: 2, positions: [], placed: false },
      { id: 107, type: 'boat', size: 1, positions: [], placed: false },
      { id: 108, type: 'boat', size: 1, positions: [], placed: false },
      { id: 109, type: 'boat', size: 1, positions: [], placed: false },
      { id: 110, type: 'boat', size: 1, positions: [], placed: false }
    ];

    // Выбор стратегии в зависимости от уровня сложности
    let strategy: string;
    switch (this.selectedDifficulty) {
      case DifficultyLevel.EASY:
        strategy = 'random'; // Простая случайная расстановка
        break;
      case DifficultyLevel.MEDIUM:
        strategy = 'coastal'; // Расстановка у берегов
        break;
      case DifficultyLevel.HARD:
        strategy = 'spread'; // Разбросанная стратегия
        break;
      default:
        strategy = 'coastal';
    }

    // Генерация расстановки
    this.generateAIStrategy(aiShips, strategy);

    // Конвертация в формат сервера
    return this.convertShipsToPlacement(aiShips);
  }

  /**
   * Генерация расстановки по выбранной стратегии
   */
  private generateAIStrategy(ships: Ship[], strategy: string): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      const shipsOfType = ships.filter(s => s.type === shipType.type && !s.placed);

      for (const ship of shipsOfType) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
          const position = this.getAIShipPosition(ship.size, strategy);

          if (this.canPlaceAIShip(ships, ship, position.row, position.col, position.orientation)) {
            this.placeAIShip(ships, ship, position.row, position.col, position.orientation);
            placed = true;
          }

          attempts++;
        }

        // Если не удалось разместить - размещаем случайно
        if (!placed) {
          this.placeAIRandomly(ships, ship);
        }
      }
    }
  }

  /**
   * Получение позиции для корабля ИИ в зависимости от стратегии
   */
  private getAIShipPosition(size: number, strategy: string): {
    row: string,
    col: number,
    orientation: boolean
  } {
    const randomRow = this.rows[Math.floor(Math.random() * this.rows.length)];
    const randomCol = this.columns[Math.floor(Math.random() * this.columns.length)];
    const randomOrientation = Math.random() > 0.5;

    switch (strategy) {
      case 'coastal':
        // Преимущественно у берегов
        const side = Math.floor(Math.random() * 4);
        switch(side) {
          case 0: // Верхний край
            return {
              row: this.rows[Math.floor(Math.random() * 2)],
              col: Math.floor(Math.random() * BOARD_SIZE) + 1,
              orientation: randomOrientation
            };
          case 1: // Правый край
            return {
              row: this.rows[Math.floor(Math.random() * BOARD_SIZE)],
              col: BOARD_SIZE - Math.floor(Math.random() * 2),
              orientation: randomOrientation
            };
          case 2: // Нижний край
            return {
              row: this.rows[BOARD_SIZE - 1 - Math.floor(Math.random() * 2)],
              col: Math.floor(Math.random() * BOARD_SIZE) + 1,
              orientation: randomOrientation
            };
          case 3: // Левый край
            return {
              row: this.rows[Math.floor(Math.random() * BOARD_SIZE)],
              col: 1 + Math.floor(Math.random() * 2),
              orientation: randomOrientation
            };
        }
        break;

      case 'spread':
        // Равномерное распределение
        const centerRows = ['В', 'Г', 'Д', 'Е', 'Ж', 'З'];
        const centerCols = [3, 4, 5, 6, 7, 8];
        return {
          row: centerRows[Math.floor(Math.random() * centerRows.length)],
          col: centerCols[Math.floor(Math.random() * centerCols.length)],
          orientation: randomOrientation
        };

      default: // 'random'
        return {
          row: randomRow,
          col: randomCol,
          orientation: randomOrientation
        };
    }

    return {
      row: randomRow,
      col: randomCol,
      orientation: randomOrientation
    };
  }

  /**
   * Проверка возможности размещения корабля ИИ
   */
  private canPlaceAIShip(allShips: Ship[], ship: Ship, row: string, col: number, orientation: boolean): boolean {
    const positions = this.getShipPositions(ship.size, row, col, orientation);

    // Проверка границ
    for (const pos of positions) {
      if (!this.isValidPosition(pos.row, pos.col)) {
        return false;
      }
    }

    // Проверка пересечения с другими кораблями
    for (const pos of positions) {
      for (const otherShip of allShips) {
        if (otherShip.placed && otherShip.positions.some(p => p.row === pos.row && p.col === pos.col)) {
          return false;
        }
      }
    }

    // Проверка соседства
    for (const pos of positions) {
      if (this.hasAdjacentAIShip(allShips, pos.row, pos.col)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Проверка соседства для корабля ИИ
   */
  private hasAdjacentAIShip(allShips: Ship[], row: string, col: number): boolean {
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

        for (const ship of allShips) {
          if (ship.placed && ship.positions.some(p => p.row === adjacentRow && p.col === newCol)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Размещение корабля ИИ
   */
  private placeAIShip(allShips: Ship[], ship: Ship, row: string, col: number, orientation: boolean): void {
    const currentOrientation = this.isHorizontal;
    this.isHorizontal = orientation;

    const positions = this.getShipPositions(ship.size, row, col, orientation);

    ship.positions = positions;
    ship.placed = true;

    this.isHorizontal = currentOrientation;
  }

  /**
   * Случайное размещение корабля ИИ
   */
  private placeAIRandomly(allShips: Ship[], ship: Ship): void {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      const randomRow = this.rows[Math.floor(Math.random() * this.rows.length)];
      const randomCol = this.columns[Math.floor(Math.random() * this.columns.length)];
      const randomOrientation = Math.random() > 0.5;

      if (this.canPlaceAIShip(allShips, ship, randomRow, randomCol, randomOrientation)) {
        this.placeAIShip(allShips, ship, randomRow, randomCol, randomOrientation);
        placed = true;
      }

      attempts++;
    }
  }

  /**
   * Конвертация кораблей ИИ в формат размещения
   */
  private convertShipsToPlacement(ships: Ship[]): ShipPlacement[] {
    const placements: ShipPlacement[] = [];

    ships.forEach(ship => {
      if (ship.placed && ship.positions.length > 0) {
        const firstPosition = ship.positions[0];
        const lastPosition = ship.positions[ship.positions.length - 1];

        const row = this.rows.indexOf(firstPosition.row);
        const col = firstPosition.col - 1;
        const vertical = firstPosition.row !== lastPosition.row;

        placements.push({
          shipId: ship.id,
          size: ship.size,
          row: row,
          col: col,
          vertical: vertical
        });
      }
    });

    return placements;
  }

  // ==================== МЕТОДЫ DRAG & DROP (остаются без изменений) ====================

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

  onDragOver(event: DragEvent) {
    event.preventDefault();

    const target = event.target as HTMLElement;
    if (target.classList.contains('cell')) {
      const row = target.getAttribute('data-row');
      const col = parseInt(target.getAttribute('data-col') || '0');

      if (row) {
        this.hoveredCell = { row, col };

        if (this.draggedShip) {
          this.potentialPositions = this.getShipPositions(this.draggedShip.size, row, col, this.isHorizontal);
        }
      }
    }
  }

  onDragLeave(event: DragEvent) {
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  onDrop(event: DragEvent) {
    event.preventDefault();

    if (!this.draggedShip || !this.hoveredCell) return;

    const { row, col } = this.hoveredCell;

    if (this.canPlaceShip(this.draggedShip, row, col)) {
      this.placeShip(this.draggedShip, row, col);
      this.isPlayerReady = false; // Сброс готовности при изменении расстановки
    }

    this.draggedShip = null;
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  // ==================== МЕТОДЫ РАБОТЫ С ПОПАПАМИ ====================

  openLoadPopup() {
    this.showLoadPopup = true;
  }

  closeLoadPopup() {
    this.showLoadPopup = false;
  }

  openSavePopup() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Ошибка', 'Нельзя сохранить пустую расстановку! Разместите хотя бы один корабль.', true);
      return;
    }
    this.newPlacementName = `Моя расстановка ${new Date().toLocaleDateString('ru-RU')}`;
    this.showSavePopup = true;
  }

  closeSavePopup() {
    this.showSavePopup = false;
    this.newPlacementName = '';
  }

  // ==================== МЕТОДЫ ПРОВЕРКИ И ВАЛИДАЦИИ ====================

  hasAtLeastOneShip(): boolean {
    return this.ships.some(ship => ship.placed && ship.positions.length > 0);
  }

  isPlacementNameUnique(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return !this.userPlacements.some(placement =>
      placement.name.toLowerCase() === normalizedName
    );
  }

  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  isValidPosition(row: string, col: number): boolean {
    const rowIndex = this.rows.indexOf(row);
    return rowIndex >= 0 && rowIndex < this.rows.length &&
      col >= 1 && col <= this.columns.length;
  }

  hasShip(row: string, col: number): boolean {
    return this.ships.some(ship =>
      ship.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

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

  canPlaceShip(ship: any, startRow: string, startCol: number): boolean {
    const positions = this.getShipPositions(ship.size, startRow, startCol, this.isHorizontal);

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

  isValidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  isInvalidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      !this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  // ==================== МЕТОДЫ РАСЧЕТА ПОЗИЦИЙ ====================

  getShipPositions(size: number, startRow: string, startCol: number, isHorizontal: boolean): { row: string, col: number }[] {
    const positions = [];
    const startRowIndex = this.rows.indexOf(startRow);

    if (isHorizontal) {
      const shouldFlip = this.shouldFlipHorizontal(startCol, size);

      if (shouldFlip) {
        for (let i = 0; i < size; i++) {
          positions.push({ row: startRow, col: startCol + i });
        }
      } else {
        for (let i = 0; i < size; i++) {
          positions.push({ row: startRow, col: startCol - i });
        }
      }
    } else {
      const shouldFlip = this.shouldFlipVertical(startRowIndex, size);

      if (shouldFlip) {
        for (let i = 0; i < size; i++) {
          if (startRowIndex + i < this.rows.length) {
            positions.push({ row: this.rows[startRowIndex + i], col: startCol });
          }
        }
      } else {
        for (let i = 0; i < size; i++) {
          if (startRowIndex - i >= 0) {
            positions.push({ row: this.rows[startRowIndex - i], col: startCol });
          }
        }
      }
    }

    return positions;
  }

  shouldFlipHorizontal(startCol: number, size: number): boolean {
    if (startCol <= size) return true;
    if (startCol >= this.columns.length - size + 1) return false;
    return true;
  }

  shouldFlipVertical(startRowIndex: number, size: number): boolean {
    if (startRowIndex < size) return true;
    if (startRowIndex >= this.rows.length - size) return false;
    return true;
  }

  // ==================== МЕТОДЫ РАЗМЕЩЕНИЯ КОРАБЛЕЙ ====================

  placeShip(ship: any, startRow: string, startCol: number) {
    const positions = this.getShipPositions(ship.size, startRow, startCol, this.isHorizontal);

    const availableShip = this.ships.find(s =>
      s.type === ship.type && !s.placed
    );

    if (availableShip) {
      availableShip.positions = positions;
      availableShip.placed = true;
    }
  }

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

  // ==================== МЕТОДЫ СОХРАНЕНИЯ И ЗАГРУЗКИ ====================

  savePlacement() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Ошибка', 'Нельзя сохранить пустую расстановку!', true);
      return;
    }

    const trimmedName = this.newPlacementName.trim();
    if (!trimmedName) {
      this.showMessage('Ошибка', 'Введите название расстановки!', true);
      return;
    }

    if (!this.isPlacementNameUnique(trimmedName)) {
      this.showMessage('Ошибка', 'Расстановка с таким названием уже существует! Выберите другое название.', true);
      return;
    }

    const newPlacement: UserPlacement = {
      id: Date.now(),
      name: trimmedName,
      date: new Date(),
      ships: this.ships.map(ship => ({
        ...ship,
        positions: [...ship.positions]
      }))
    };

    this.userPlacements.unshift(newPlacement);
    this.saveToLocalStorage();
    this.closeSavePopup();

    this.showMessage('Успешно', `Расстановка "${newPlacement.name}" сохранена!`, true);
  }

  private saveToLocalStorage() {
    try {
      const key = `battleshipPlacements_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.userPlacements));
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      this.showMessage('Ошибка', 'Не удалось сохранить расстановку', true);
    }
  }

  loadUserPlacements() {
    try {
      const key = `battleshipPlacements_${this.userId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.userPlacements = parsed.map((placement: any) => ({
          ...placement,
          date: new Date(placement.date)
        }));
      } else {
        this.userPlacements = [];
      }
    } catch (error) {
      console.error('Ошибка при загрузке:', error);
      this.userPlacements = [];
    }
  }

  loadUserPlacement(placement: UserPlacement) {
    this.clearBoard();

    placement.ships.forEach(savedShip => {
      const existingShip = this.ships.find(ship => ship.id === savedShip.id);
      if (existingShip) {
        existingShip.positions = [...savedShip.positions];
        existingShip.placed = savedShip.placed;
      }
    });

    this.closeLoadPopup();
    this.showMessage('Загружено', `Расстановка "${placement.name}" загружена`, true);
  }

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

  // ==================== СТРАТЕГИИ АВТОМАТИЧЕСКОЙ РАССТАНОВКИ ====================

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

    this.closeLoadPopup();
    this.showMessage('Стратегия загружена', `Применена стратегия: ${strategy}`, true);
  }

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

  // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

  showMessage(title: string, text: string, autoClose: boolean = true) {
    this.messageTitle = title;
    this.messageText = text;
    this.showMessagePopup = true;
    if (autoClose) {
      setTimeout(() => {
        if (this.showMessagePopup) {
          this.closeMessagePopup();
        }
      }, 5000);
    }
  }

  closeMessagePopup() {
    this.showMessagePopup = false;
  }
}
