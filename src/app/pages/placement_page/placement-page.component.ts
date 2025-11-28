import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import {
  PlacementApiService,
  PlacementRequest,
  PlacementResponse,
  ShipPlacementDto,
  SavePlacementRequest,
  UserPlacementResponse
} from '../../services/placement-api.service';

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

@Component({
  selector: 'app-placement-user-page',
  standalone: true,
  imports: [DatePipe, FormsModule, HttpClientModule],
  templateUrl: './placement-user-page.component.html',
  styleUrl: './placement-user-page.component.scss'
})
export class PlacementUserPageComponent implements OnInit {
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

  /** Название новой сохраняемой расстановки */
  newPlacementName: string = '';

  /** Список сохраненных пользовательских расстановок */
  userPlacements: UserPlacement[] = [];

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

  /** Статус загрузки */
  isLoading = false;

  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;

  /** Выбранная стратегия */
  selectedStrategy: string = 'manual';

  /** Выбранный размер корабля для ручного размещения */
  selectedShipSize: number = 4;

  constructor(
    private readonly authService: AuthService,
    private readonly placementApi: PlacementApiService
  ) {}

  /**
   * Геттер для получения ID текущего пользователя
   */
  private get userId(): string {
    if (this.currentPlayer && this.currentPlayer.id) {
      return this.currentPlayer.id;
    }
    return 'unknown_user';
  }

  ngOnInit() {
    this.loadCurrentPlayer();
  }

  /**
   * Загрузка данных текущего пользователя
   */
  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь:', this.currentPlayer);
    this.loadUserPlacements();
  }

  // ==================== МЕТОДЫ УПРАВЛЕНИЯ СТРАТЕГИЯМИ ====================

  /**
   * Обработчик изменения стратегии
   */
  onStrategyChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedStrategy = target.value;

    // Автоматически применяем стратегию (кроме ручной)
    if (this.selectedStrategy !== 'manual') {
      this.applySelectedStrategy();
    }
  }

  /**
   * Применение выбранной стратегии
   */
  applySelectedStrategy(): void {
    if (this.selectedStrategy !== 'manual') {
      this.generatePlacement(this.selectedStrategy);
    }
  }

  /**
   * Обработчик авторасстановки
   */
  onAutoPlace(): void {
    if (this.selectedStrategy === 'manual') {
      // В ручном режиме - случайная расстановка
      this.generatePlacement('random');
    } else {
      // В режиме стратегии - применяем выбранную
      this.applySelectedStrategy();
    }
  }

  /**
   * Получение текста для кнопки авторасстановки
   */
  getAutoPlaceButtonText(): string {
    if (this.isLoading) {
      return 'Генерация...';
    }

    switch (this.selectedStrategy) {
      case 'manual': return 'Случайная расстановка';
      case 'random': return 'Применить случайную';
      case 'coastal': return 'Применить береговую';
      case 'diagonal': return 'Применить диагональную';
      case 'halfField': return 'Применить полупольную';
      default: return 'Авторасстановка';
    }
  }

  // ==================== МЕТОДЫ РУЧНОГО РАЗМЕЩЕНИЯ ====================

  /**
   * Выбор корабля для ручного размещения
   */
  selectShip(size: number): void {
    if (this.getRemainingShipsCount(this.getShipType(size)) > 0) {
      this.selectedShipSize = size;
    }
  }

  /**
   * Обработчик клика по ячейке (для ручного размещения)
   */
  onCellClick(row: string, col: number): void {
    if (this.selectedStrategy !== 'manual' || !this.selectedShipSize) {
      return;
    }

    const ship = {
      size: this.selectedShipSize,
      type: this.getShipType(this.selectedShipSize)
    };

    if (this.canPlaceShip(ship, row, col)) {
      this.placeShip(ship, row, col);
    }
  }

  /**
   * Переключение ориентации корабля
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
  }

  // ==================== API МЕТОДЫ ====================

  /**
   * Генерация расстановки через серверный API
   */
  private generatePlacement(strategy: string): void {
    this.isLoading = true;

    const request: PlacementRequest = {
      strategy: strategy,
      userId: this.userId,
      saveToProfile: false
    };

    this.placementApi.generatePlacement(request).subscribe({
      next: (response: PlacementResponse) => {
        this.isLoading = false;
        if (response.success) {
          this.ships = this.convertToClientFormat(response.placements);
          console.log(`Расстановка "${strategy}" успешно загружена с сервера`);
        } else {
          alert('Ошибка генерации: ' + response.message);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('API Error:', error);
        // Fallback на локальную генерацию при ошибке
        this.generateLocalPlacement(strategy);
      }
    });
  }

  /**
   * Локальная генерация расстановки (fallback при ошибках API)
   */
  private generateLocalPlacement(strategy: string): void {
    this.clearBoard();

    // Простая случайная генерация как fallback
    const shipTypes = [
      { type: 'battleship', size: 4, count: 1 },
      { type: 'cruiser', size: 3, count: 2 },
      { type: 'destroyer', size: 2, count: 3 },
      { type: 'boat', size: 1, count: 4 }
    ];

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        this.placeShipRandomly(shipType.size, shipType.type);
      }
    }

    alert('Используется локальная генерация (сервер недоступен)');
  }

  /**
   * Случайное размещение корабля на поле (fallback)
   */
  private placeShipRandomly(size: number, type: string) {
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

  /**
   * Сохранение текущей расстановки на сервер
   */
  savePlacement() {
    if (!this.hasAtLeastOneShip()) {
      alert('Нельзя сохранить пустую расстановку!');
      return;
    }

    const trimmedName = this.newPlacementName.trim();
    if (!trimmedName) {
      alert('Введите название расстановки!');
      return;
    }

    if (!this.isPlacementNameUnique(trimmedName)) {
      alert('Расстановка с таким названием уже существует! Выберите другое название.');
      return;
    }

    const serverShips = this.convertToServerFormat();
    const request: SavePlacementRequest = {
      userId: this.userId,
      placementName: trimmedName,
      ships: serverShips
    };

    this.placementApi.saveUserPlacement(request).subscribe({
      next: () => {
        alert(`Расстановка "${trimmedName}" успешно сохранена!`);
        this.closeSavePopup();
        this.loadUserPlacements(); // Обновляем список
      },
      error: (error) => {
        console.error('Save placement error:', error);
        // Fallback на localStorage
        this.saveToLocalStorage(trimmedName);
        alert('Расстановка сохранена локально (сервер недоступен)');
        this.closeSavePopup();
      }
    });
  }

  /**
   * Загрузка пользовательских расстановок с сервера
   */
  loadUserPlacements() {
    this.placementApi.getUserPlacements(this.userId).subscribe({
      next: (serverPlacements: UserPlacementResponse[]) => {
        this.userPlacements = serverPlacements.map(placement => ({
          id: placement.id,
          name: placement.name,
          date: placement.createdDate,
          ships: this.convertToClientFormat(placement.ships)
        }));
      },
      error: (error) => {
        console.error('Load placements error:', error);
        // В случае ошибки используем локальные данные
        this.loadLocalPlacements();
      }
    });
  }

  /**
   * Загрузка расстановки из списка сохраненных
   */
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
    console.log(`Загружена пользовательская расстановка: ${placement.name}`);
  }

  /**
   * Удаление сохраненной расстановки
   */
  deletePlacement(placement: UserPlacement): void {
    if (confirm(`Удалить расстановку "${placement.name}"?`)) {
      this.userPlacements = this.userPlacements.filter(p => p.id !== placement.id);
      this.saveToLocalStorage();
    }
  }

  // ==================== КОНВЕРТАЦИЯ ФОРМАТОВ ====================

  /**
   * Конвертация серверного формата в клиентский
   */
  private convertToClientFormat(serverShips: ShipPlacementDto[]): Ship[] {
    const clientShips: Ship[] = [];

    serverShips.forEach(serverShip => {
      const positions = this.calculatePositions(serverShip);
      const shipType = this.getShipType(serverShip.size);

      clientShips.push({
        id: serverShip.shipId,
        type: shipType,
        size: serverShip.size,
        positions: positions,
        placed: true
      });
    });

    return clientShips;
  }

  /**
   * Расчет позиций корабля на основе серверных данных
   */
  private calculatePositions(placement: ShipPlacementDto): { row: string; col: number }[] {
    const positions: { row: string; col: number }[] = [];

    for (let i = 0; i < placement.size; i++) {
      const rowIndex = placement.vertical ? placement.row + i : placement.row;
      const col = placement.vertical ? placement.col : placement.col + i;

      // Проверка границ
      if (rowIndex < this.rows.length && col < this.columns.length) {
        positions.push({
          row: this.rows[rowIndex],
          col: col + 1 // Конвертация в 1-based для отображения
        });
      }
    }

    return positions;
  }

  /**
   * Конвертация клиентского формата в серверный
   */
  private convertToServerFormat(): ShipPlacementDto[] {
    const serverPlacements: ShipPlacementDto[] = [];

    this.ships.forEach(ship => {
      if (ship.placed && ship.positions.length > 0) {
        const firstPosition = ship.positions[0];
        const lastPosition = ship.positions[ship.positions.length - 1];

        const row = this.rows.indexOf(firstPosition.row);
        const col = firstPosition.col - 1; // Конвертация в 0-based индекс

        // Определение ориентации
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
   * Определение типа корабля по размеру
   */
  private getShipType(size: number): string {
    switch (size) {
      case 4: return 'battleship';
      case 3: return 'cruiser';
      case 2: return 'destroyer';
      case 1: return 'boat';
      default: return 'unknown';
    }
  }

  // ==================== МЕТОДЫ DRAG & DROP ====================

  /**
   * Обработчик начала перетаскивания корабля
   */
  onDragStart(event: DragEvent, shipType: string, shipSize: number) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('draggable')) {
      this.draggedShip = {
        size: shipSize,
        type: shipType
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
      const col = Number.parseInt(target.getAttribute('data-col') || '0');

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

  // ==================== МЕТОДЫ РАБОТЫ С ПОПАПАМИ ====================

  /**
   * Открытие попапа загрузки расстановки
   */
  openLoadPopup() {
    this.showLoadPopup = true;
  }

  /**
   * Закрытие попапа загрузки расстановки
   */
  closeLoadPopup() {
    this.showLoadPopup = false;
  }

  /**
   * Открытие попапа сохранения расстановки
   */
  openSavePopup() {
    if (!this.hasAtLeastOneShip()) {
      alert('Нельзя сохранить пустую расстановку! Разместите хотя бы один корабль.');
      return;
    }
    this.newPlacementName = `Моя расстановка ${new Date().toLocaleDateString('ru-RU')}`;
    this.showSavePopup = true;
  }

  /**
   * Закрытие попапа сохранения расстановки
   */
  closeSavePopup() {
    this.showSavePopup = false;
    this.newPlacementName = '';
  }

  // ==================== ОСНОВНЫЕ МЕТОДЫ УПРАВЛЕНИЯ ====================

  /**
   * Запрос на очистку игрового поля
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
   * Полная очистка игрового поля
   */
  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
  }

  /**
   * Запуск игры после успешной расстановки всех кораблей
   */
  startGame() {
    if (this.isAllShipsPlaced()) {
      console.log('Начало игры');
      const serverFormat = this.convertToServerFormat();
      console.log('Данные для сервера:', serverFormat);
      // TODO: Отправка данных на сервер для начала игры
      alert('Игра начата! Все корабли расставлены корректно.');
    } else {
      alert('Разместите все корабли перед началом игры!');
    }
  }

  // ==================== ВАЛИДАЦИЯ И ПРОВЕРКИ ====================

  /**
   * Проверка, что на поле размещен хотя бы один корабль
   */
  hasAtLeastOneShip(): boolean {
    return this.ships.some(ship => ship.placed && ship.positions.length > 0);
  }

  /**
   * Проверка уникальности названия расстановки
   */
  isPlacementNameUnique(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return !this.userPlacements.some(placement =>
      placement.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Проверка, что все корабли размещены на поле
   */
  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  /**
   * Получение количества оставшихся для размещения кораблей определенного типа
   */
  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  /**
   * Проверка является ли ячейка hovered
   */
  isCellHovered(row: string, col: number): boolean {
    return this.hoveredCell?.row === row && this.hoveredCell?.col === col;
  }

  // ==================== ЛОГИКА РАЗМЕЩЕНИЯ КОРАБЛЕЙ ====================

  /**
   * Проверка возможности размещения корабля в указанной позиции
   */
  canPlaceShip(ship: any, startRow: string, startCol: number): boolean {
    const positions = this.getShipPositions(ship.size, startRow, startCol);

    // Проверка выхода за границы поля
    for (const pos of positions) {
      if (!this.isValidPosition(pos.row, pos.col)) {
        return false;
      }
    }

    // Проверка пересечения с другими кораблями и правил соседства
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
   * Проверка валидности позиции на игровом поле
   */
  private isValidPosition(row: string, col: number): boolean {
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
  private hasAdjacentShip(row: string, col: number): boolean {
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
   * Расчет всех позиций корабля исходя из начальной точки и ориентации
   */
  private getShipPositions(size: number, startRow: string, startCol: number): { row: string, col: number }[] {
    const positions = [];
    const startRowIndex = this.rows.indexOf(startRow);

    if (this.isHorizontal) {
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

  /**
   * Определение направления размещения для горизонтальной ориентации
   */
  private shouldFlipHorizontal(startCol: number, size: number): boolean {
    if (startCol <= size) return true;
    return startCol < this.columns.length - size + 1;

  }

  /**
   * Определение направления размещения для вертикальной ориентации
   */
  private shouldFlipVertical(startRowIndex: number, size: number): boolean {
    if (startRowIndex < size) return true;
    return startRowIndex < this.rows.length - size;

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

  // ==================== ЛОКАЛЬНОЕ ХРАНЕНИЕ (FALLBACK) ====================

  /**
   * Загрузка локальных расстановок (fallback)
   */
  private loadLocalPlacements() {
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
      console.error('Ошибка при загрузке из localStorage:', error);
      this.userPlacements = [];
    }
  }

  /**
   * Сохранение в localStorage (fallback)
   */
  private saveToLocalStorage(name?: string): void {
    try {
      if (name) {
        // Сохранение новой расстановки
        const newPlacement: UserPlacement = {
          id: Date.now(),
          name: name,
          date: new Date(),
          ships: this.ships.map(ship => ({
            ...ship,
            positions: [...ship.positions]
          }))
        };

        this.userPlacements.unshift(newPlacement);
      }

      const key = `battleshipPlacements_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.userPlacements));
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
    }
  }
}
