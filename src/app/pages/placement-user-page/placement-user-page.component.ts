import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { WebSocketService, GameStartNotification } from '../../services/webSocket.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

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
 * Интерфейс для передачи данных о расстановке на сервер
 */
interface ShipPlacement {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

interface GameReadyMessage {
  playerId: number;
  opponentId: number;
  boardLayout: BoardLayoutDTO;
  gameType: string;
}

interface BoardLayoutDTO {
  ships: ShipPlacement[];
  matrix: string[][];
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
  selector: 'app-placement-user-page',
  standalone: true,
  imports: [DatePipe, FormsModule, CommonModule],
  templateUrl: './placement-user-page.component.html',
  styleUrl: './placement-user-page.component.scss'
})
export class PlacementUserPageComponent {
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  isHorizontal = true;
  draggedShip: any = null;
  hoveredCell: { row: string, col: number } | null = null;
  potentialPositions: { row: string, col: number }[] = [];

  showLoadPopup = false;
  showSavePopup = false;
  showClearConfirmation = false;
  showCancelReadyPopup = false;
  showMessagePopup = false;
  messageTitle = '';
  messageText = '';

  newPlacementName: string = '';
  userPlacements: UserPlacement[] = [];

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
  opponentId: number | null = null;
  gameId: number | null = null;
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
    private webSocketService: WebSocketService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadCurrentPlayer();
    
    this.route.queryParams.subscribe(params => {
      if (params['opponentId']) {
        this.opponentId = +params['opponentId'];
        console.log('Получен ID оппонента:', this.opponentId);
      } else {
        console.warn('Параметр opponentId не найден в URL');
      }
    });

    this.webSocketService.subscribeToGameStartDirect((notification) => {
      if (notification.gameId) {
        console.log('Игра началась! ID:', notification.gameId);
        this.gameId = notification.gameId;
        this.navigateToGamePage(notification);
      }
    });
  }

  private navigateToGamePage(notification: GameStartNotification): void {
    const playerId = this.currentPlayer?.player_id;

    if (!playerId) {
      this.showMessage('Ошибка навигации', 'Player ID не найден для навигации', false);
      return;
    }

    const queryParams = {
      gameId: notification.gameId,
      playerId: playerId,
      opponentId: notification.opponentId
    };

    console.log('Переход на страницу игры с параметрами:', queryParams);

    this.router.navigate(['/two-players-field', notification.gameId], {
      queryParams: queryParams
    });
  }

  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь:', this.currentPlayer);

    if (!this.currentPlayer) {
      console.error('Пользователь не авторизован');
      this.showMessage(
        'Ошибка авторизации', 
        'Вы не авторизованы. Пожалуйста, войдите в систему.',
        false
      ).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    if (this.currentPlayer.player_id) {
      this.savePlayerIdForNextPage(this.currentPlayer.player_id);
    }

    this.loadUserPlacements();
  }

  requestClearBoard() {
    if (!this.hasAtLeastOneShip()) {
      return;
    }
    this.showClearConfirmation = true;
  }

  confirmClear() {
    this.clearBoard();
    this.showClearConfirmation = false;
    this.showMessage('Поле очищено', 'Все корабли удалены с игрового поля');
  }

  cancelClear() {
    this.showClearConfirmation = false;
  }

  /**
   * Переключение ориентации корабля (горизонтальная/вертикальная)
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
  }

  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
  }

  generateRandom() {
    this.clearBoard();

    const shipTypes = [...SHIP_TYPES];

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        this.placeShipRandomly(shipType.size, shipType.type);
      }
    }

    this.showMessage('Случайная расстановка', 'Корабли расставлены случайным образом');
  }

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

  startGame() {
    if (this.isAllShipsPlaced()) {
      console.log('Начало игры');
      const serverFormat = this.convertToServerFormat();
      console.log('Данные для сервера:', serverFormat);
      this.router.navigate(['/two-players-field']);
    } else {
      this.showMessage(
        'Не все корабли размещены', 
        'Разместите все корабли перед началом игры!'
      );
    }
  }

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

  playerReady() {
    if (!this.isAllShipsPlaced()) {
      this.showMessage('Не все корабли размещены', 'Разместите все корабли перед началом игры!');
      return;
    }

    if (!this.opponentId) {
      this.showMessage(
        'Ошибка оппонента', 
        'Ошибка: оппонент не определен. Перезагрузите страницу.',
        false
      );
      return;
    }

    if (!this.webSocketService.isConnected()) {
      this.showMessage(
        'Ошибка соединения', 
        'Ошибка соединения с сервером. Попробуйте обновить страницу.',
        false
      );
      return;
    }

    const playerId = this.currentPlayer.player_id;
    if (!playerId) {
      this.showMessage(
        'Ошибка идентификации', 
        'Ошибка: не удалось определить ваш ID. Пожалуйста, перезагрузите страницу.',
        false
      );
      return;
    }

    this.savePlayerIdForNextPage(playerId);

    const boardLayout = this.convertToBoardLayoutDTO();

    const readyMessage: GameReadyMessage = {
      playerId: playerId,
      opponentId: this.opponentId,
      boardLayout: boardLayout,
      gameType: 'MULTIPLAYER'
    };

    console.log('Отправка сообщения о готовности:', readyMessage);
    this.webSocketService.sendPlayerReady(readyMessage);
    this.isPlayerReady = true;
    this.showMessage(
      'Готовность подтверждена', 
      'Вы готовы к игре! Ожидаем готовности оппонента...'
    );
  }

  private savePlayerIdForNextPage(playerId: number): void {
    sessionStorage.setItem('currentPlayerId', playerId.toString());
    localStorage.setItem('playerId', playerId.toString());
    console.log('Player ID сохранен для следующей страницы:', playerId);
  }

  cancelReady() {
    this.showCancelReadyPopup = true;
  }

  confirmCancelReady() {
    this.isPlayerReady = false;
    this.showCancelReadyPopup = false;
    
    this.showMessage(
      'Готовность отменена',
      'Вы можете изменить расстановку кораблей. Окно может быть закрыто автоматически через 5 секунд или нажатием на кнопку'
    );
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
          this.potentialPositions = this.getShipPositions(this.draggedShip.size, row, col);
        }
      }
    }
  }

  onDragLeave(event: DragEvent) {
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  /**
   * Обработчик завершения перетаскивания - размещение корабля на поле
   * @param event - Событие перетаскивания
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

  openLoadPopup() {
    this.showLoadPopup = true;
  }

  closeLoadPopup() {
    this.showLoadPopup = false;
  }

  openSavePopup() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Пустая расстановка', 'Нельзя сохранить пустую расстановку! Разместите хотя бы один корабль.');
      return;
    }
    this.newPlacementName = `Моя расстановка ${new Date().toLocaleDateString('ru-RU')}`;
    this.showSavePopup = true;
  }

  closeSavePopup() {
    this.showSavePopup = false;
    this.newPlacementName = '';
  }

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
      { r: -1, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: -1 },
      { r: 0, c: 1 },
      { r: -1, c: -1 },
      { r: -1, c: 1 },
      { r: 1, c: -1 },
      { r: 1, c: 1 }
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

  shouldFlipHorizontal(startCol: number, size: number): boolean {
    if (startCol <= size) {
      return true;
    }
    if (startCol >= this.columns.length - size + 1) {
      return false;
    }
    return true;
  }

  shouldFlipVertical(startRowIndex: number, size: number): boolean {
    if (startRowIndex < size) {
      return true;
    }
    if (startRowIndex >= this.rows.length - size) {
      return false;
    }
    return true;
  }

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

  savePlacement() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Сохранение расстановки', 'Нельзя сохранить пустую расстановку!');
      return;
    }

    const trimmedName = this.newPlacementName.trim();
    if (!trimmedName) {
      this.showMessage('Сохранение расстановки', 'Введите название расстановки!');
      return;
    }

    if (!this.isPlacementNameUnique(trimmedName)) {
      this.showMessage('Сохранение расстановки', 'Расстановка с таким названием уже существует! Выберите другое название.');
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

    this.showMessage('Сохранение расстановки', `Расстановка "${newPlacement.name}" успешно сохранена!`);
    console.log('Сохраненная расстановка:', newPlacement);
  }

  private saveToLocalStorage() {
    try {
      const key = `battleshipPlacements_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.userPlacements));
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
      this.showMessage('Ошибка сохранения', 'Произошла ошибка при сохранении расстановки.', false);
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
      console.error('Ошибка при загрузке из localStorage:', error);
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
    this.showMessage('Загрузка расстановки', `Загружена пользовательская расстановка: ${placement.name}`);
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

  private loadFromServerFormat(placements: ShipPlacement[]) {
    this.clearBoard();

    placements.forEach(serverPlacement => {
      const ship = this.ships.find(s => s.id === serverPlacement.shipId);
      if (ship) {
        const positions: { row: string; col: number }[] = [];

        for (let i = 0; i < serverPlacement.size; i++) {
          const rowIndex = serverPlacement.row + (serverPlacement.vertical ? i : 0);
          const col = serverPlacement.col + (serverPlacement.vertical ? 0 : i) + 1;

          if (rowIndex < this.rows.length && col <= this.columns.length) {
            positions.push({
              row: this.rows[rowIndex],
              col: col
            });
          }
        }

        ship.positions = positions;
        ship.placed = true;
      }
    });
  }

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
    this.showMessage('Стратегия загружена', `Загружена стратегия: ${this.getStrategyName(strategy)}`);
  }

  private getStrategyName(strategy: string): string {
    const strategyNames: {[key: string]: string} = {
      'coastal': 'Береговая',
      'diagonal': 'Диагональная',
      'halfField': 'Полупольная',
      'spread': 'Разброс'
    };
    return strategyNames[strategy] || strategy;
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

  closeCancelReadyPopup() {
    this.showCancelReadyPopup = false;
  }

  showMessage(title: string, text: string, autoClose: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      this.messageTitle = title;
      this.messageText = text;
      this.showMessagePopup = true;
      
      if (autoClose) {
        setTimeout(() => {
          if (this.showMessagePopup) {
            this.closeMessagePopup();
          }
          resolve();
        }, 5000);
      } else {
        resolve();
      }
    });
  }

  closeMessagePopup() {
    this.showMessagePopup = false;
    this.messageTitle = '';
    this.messageText = '';
  }
}