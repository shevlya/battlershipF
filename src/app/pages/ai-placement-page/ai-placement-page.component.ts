import { Component } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ComputerGameService } from '../../services/computer-game.service'; // Добавьте этот импорт
import { ComputerGameStartRequest, ComputerGame } from '../../services/computer-game.interface'; // Добавьте этот импорт

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
  { type: 'battleship', size: 4, count: 1 },
  { type: 'cruiser', size: 3, count: 2 },
  { type: 'destroyer', size: 2, count: 3 },
  { type: 'boat', size: 1, count: 4 }
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

@Component({
  selector: 'app-ai-placement-page',
  standalone: true,
  imports: [DatePipe, FormsModule, CommonModule],
  templateUrl: './ai-placement-page.component.html',
  styleUrl: './ai-placement-page.component.scss'
})
export class AiPlacementPageComponent {
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  isHorizontal = true;
  draggedShip: any = null;
  hoveredCell: { row: string, col: number } | null = null;
  potentialPositions: { row: string, col: number }[] = [];

  showLoadPopup = false;
  showSavePopup = false;
  showClearConfirmation = false;
  showDifficultyPopup = false;
  showMessagePopup = false;

  messageTitle = '';
  messageText = '';
  newPlacementName: string = '';
  userPlacements: UserPlacement[] = [];

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

  selectedDifficulty: DifficultyLevel = DifficultyLevel.MEDIUM;

  difficultyLevels = [
    { value: DifficultyLevel.EASY, label: 'Легкий', description: 'ИИ стреляет случайно' },
    { value: DifficultyLevel.MEDIUM, label: 'Средний', description: 'ИИ использует базовую логику' },
    { value: DifficultyLevel.HARD, label: 'Сложный', description: 'ИИ использует продвинутые алгоритмы' }
  ];

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

  isPlayerReady = false;
  currentPlayer: any = null;

  private get userId(): string {
    if (this.currentPlayer && this.currentPlayer.player_id) {
      return this.currentPlayer.player_id;
    }
    return 'unknown_user';
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private computerGameService: ComputerGameService // Добавьте этот сервис
  ) {}

  ngOnInit() {
    this.loadCurrentPlayer();
  }

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

  requestClearBoard() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Ошибка', 'На поле нет кораблей для очистки', true);
      return;
    }
    this.showClearConfirmation = true;
  }

  confirmClear() {
    this.clearBoard();
    this.showClearConfirmation = false;
    this.showMessage('Поле очищено', 'Все корабли были удалены с поля', true);
  }

  cancelClear() {
    this.showClearConfirmation = false;
  }

  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
    const orientation = this.isHorizontal ? 'горизонтально' : 'вертикально';
    this.showMessage('Ориентация изменена', `Корабли теперь размещаются ${orientation}`, true);
  }

  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
    this.isPlayerReady = false;
  }

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

  getShipTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      'battleship': 'Линкор',
      'cruiser': 'Крейсер',
      'destroyer': 'Эсминец',
      'boat': 'Катер'
    };
    return typeNames[type] || type;
  }

  getTotalRemainingShipsCount(): number {
    return this.ships.filter(ship => !ship.placed).length;
  }

  getDifficultyLabel(level: DifficultyLevel): string {
    const levelObj = this.difficultyLevels.find(d => d.value === level);
    return levelObj ? levelObj.label : 'Средний';
  }

  showDifficultySelection() {
    this.showDifficultyPopup = true;
  }

  closeDifficultyPopup() {
    this.showDifficultyPopup = false;
  }

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

    if (!this.currentPlayer?.player_id) {
      this.showMessage('Ошибка', 'Пользователь не авторизован', false);
      return;
    }

    const playerShips = this.convertToServerFormat();

    if (playerShips.length !== 10) {
      this.showMessage('Ошибка', 'Должно быть размещено 10 кораблей!', false);
      return;
    }

    // Сохраняем расстановку локально
    localStorage.setItem('playerShips', JSON.stringify(playerShips));
    localStorage.setItem('aiDifficulty', this.selectedDifficulty);

    this.isPlayerReady = true;
    this.showMessage('Готов к игре!', `Уровень сложности: ${this.selectedDifficulty}. Нажмите "Начать игру", чтобы начать сражение с ИИ.`, false);
  }

  /**
   * Начать игру с ИИ
   */
  /**
   * Начать игру с ИИ
   */
  startGameWithAI() {
    if (!this.isAllShipsPlaced()) {
      this.showMessage('Не все корабли размещены', 'Разместите все корабли перед началом игры!', false);
      return;
    }

    console.log('Создание игры с уровнем сложности:', this.selectedDifficulty);

    // Преобразуем корабли игрока в формат для сервера
    const playerShips = this.convertToServerFormat();

    const request: ComputerGameStartRequest = {
      placementStrategy: this.selectedDifficulty,
      playerShips: playerShips
    };

    this.computerGameService.createComputerGame(Number(this.userId), request).subscribe({
      next: (game) => {
        console.log('Игра создана:', game);

        const gameConfig = {
          gameId: game.gameId,
          playerId: this.userId,
          difficulty: this.selectedDifficulty,
          ships: playerShips
        };

        localStorage.setItem('currentGameConfig', JSON.stringify(gameConfig));

        this.router.navigate(['/placement-user'], {
          state: { gameConfig }
        });
      },
      error: (error) => {
        console.error('Ошибка при создании игры:', error);
        this.showMessage('Ошибка', 'Не удалось создать игру с ИИ. Попробуйте еще раз.', false);
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

  // Удалите все методы генерации ИИ на фронтенде, так как теперь это делает бэкенд:
  // private generateAIPlacement(): ShipPlacement[] { ... }
  // private generateAIStrategy(ships: Ship[], strategy: string): void { ... }
  // private getAIShipPosition(size: number, strategy: string): { ... } { ... }
  // private canPlaceAIShip(allShips: Ship[], ship: Ship, row: string, col: number, orientation: boolean): boolean { ... }
  // private hasAdjacentAIShip(allShips: Ship[], row: string, col: number): boolean { ... }
  // private placeAIShip(allShips: Ship[], ship: Ship, row: string, col: number, orientation: boolean): void { ... }
  // private placeAIRandomly(allShips: Ship[], ship: Ship): void { ... }
  // private convertShipsToPlacement(ships: Ship[]): ShipPlacement[] { ... }

  // ==================== МЕТОДЫ DRAG & DROP ====================

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
      this.isPlayerReady = false;
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
    // ... (оставьте этот метод как есть)
  }

  private placeShipsDiagonal(): void {
    // ... (оставьте этот метод как есть)
  }

  private placeShipsHalfField(): void {
    // ... (оставьте этот метод как есть)
  }

  private placeShipsSpread(): void {
    // ... (оставьте этот метод как есть)
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
