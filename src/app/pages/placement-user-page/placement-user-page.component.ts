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
 * @interface Ship
 * @property {string} type - Тип корабля (battleship, cruiser, destroyer, boat)
 * @property {number} size - Размер корабля в клетках
 * @property {Array<{row: string, col: number}>} positions - Позиции корабля на поле
 * @property {boolean} placed - Флаг размещения корабля
 * @property {number} id - Уникальный идентификатор корабля
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
 * @interface UserPlacement
 * @property {number} id - Уникальный идентификатор расстановки
 * @property {string} name - Название расстановки
 * @property {Date} date - Дата создания расстановки
 * @property {Ship[]} ships - Массив кораблей в расстановке
 */
interface UserPlacement {
  id: number;
  name: string;
  date: Date;
  ships: Ship[];
}

/**
 * Интерфейс для передачи данных о расстановке на сервер
 * @interface ShipPlacement
 * @property {number} shipId - Идентификатор корабля
 * @property {number} size - Размер корабля
 * @property {number} row - Строка начальной позиции (0-9)
 * @property {number} col - Столбец начальной позиции (0-9)
 * @property {boolean} vertical - Ориентация корабля (true - вертикальная, false - горизонтальная)
 */
interface ShipPlacement {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

/**
 * Интерфейс для сообщения о готовности к игре
 * @interface GameReadyMessage
 * @property {number} playerId - Идентификатор текущего игрока
 * @property {number} opponentId - Идентификатор оппонента
 * @property {BoardLayoutDTO} boardLayout - Расстановка кораблей в формате DTO
 * @property {string} gameType - Тип игры (MULTIPLAYER)
 */
interface GameReadyMessage {
  playerId: number;
  opponentId: number;
  boardLayout: BoardLayoutDTO;
  gameType: string;
}

/**
 * Интерфейс для передачи расстановки на сервер
 * @interface BoardLayoutDTO
 * @property {ShipPlacement[]} ships - Массив размещенных кораблей
 * @property {string[][]} matrix - Матрица поля 10x10 с отметками кораблей
 */
interface BoardLayoutDTO {
  ships: ShipPlacement[];
  matrix: string[][];
}

/**
 * Конфигурация типов кораблей и их количества
 * @constant SHIP_TYPES
 * @type {Array<{type: string, size: number, count: number}>}
 */
const SHIP_TYPES = [
  { type: 'battleship', size: 4, count: 1 },
  { type: 'cruiser', size: 3, count: 2 },
  { type: 'destroyer', size: 2, count: 3 },
  { type: 'boat', size: 1, count: 4 }
];

/**
 * Размер игрового поля (10x10)
 * @constant BOARD_SIZE
 * @type {number}
 */
const BOARD_SIZE = 10;

/**
 * Компонент для расстановки кораблей перед началом игры в морской бой
 * 
 * Основные функции:
 * - Drag & Drop расстановка кораблей
 * - Сохранение/загрузка пользовательских расстановок
 * - Автоматическая расстановка по различным стратегиям
 * - Валидация правильности расстановки
 * - Отправка данных о готовности к игре через WebSocket
 * 
 * @component
 * @selector app-placement-user-page
 */
@Component({
  selector: 'app-placement-user-page',
  standalone: true,
  imports: [DatePipe, FormsModule, CommonModule],
  templateUrl: './placement-user-page.component.html',
  styleUrl: './placement-user-page.component.scss'
})
export class PlacementUserPageComponent {
  /** Буквенные обозначения строк игрового поля (А-К без Й) */
  rows = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'];

  /** Числовые обозначения столбцов игрового поля (1-10) */
  columns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /** Текущая ориентация корабля (true - горизонтальная, false - вертикальная) */
  isHorizontal = true;

  /** Перетаскиваемый корабль */
  draggedShip: any = null;

  /** Ячейка над которой находится курсор при перетаскивании */
  hoveredCell: { row: string, col: number } | null = null;

  /** Потенциальные позиции для размещения корабля при перетаскивании */
  potentialPositions: { row: string, col: number }[] = [];

  /** Флаг отображения попапа загрузки расстановки */
  showLoadPopup = false;
  
  /** Флаг отображения попапа сохранения расстановки */
  showSavePopup = false;
  
  /** Флаг отображения подтверждения очистки поля */
  showClearConfirmation = false;
  
  /** Флаг отображения попапа отмены готовности */
  showCancelReadyPopup = false;
  
  /** Флаг отображения информационного попапа (замена alert) */
  showMessagePopup = false;
  
  /** Заголовок информационного попапа */
  messageTitle = '';
  
  /** Текст информационного попапа */
  messageText = '';

  /** Название новой сохраняемой расстановки */
  newPlacementName: string = '';

  /** Список сохраненных пользовательских расстановок */
  userPlacements: UserPlacement[] = [];

  /**
   * Список кораблей для расстановки
   * @type {Ship[]}
   * @description 10 кораблей: 1 линкор (4 клетки), 2 крейсера (3 клетки), 
   * 3 эсминца (2 клетки), 4 катера (1 клетка)
   */
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

  /** Флаг готовности игрока к началу игры */
  isPlayerReady = false;
  
  /** Идентификатор оппонента (получается из query параметров) */
  opponentId: number | null = null;
  
  /** Идентификатор игры (устанавливается при получении уведомления о начале игры) */
  gameId: number | null = null;
  
  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;

  /**
   * Геттер для получения ID текущего пользователя
   * Используется для привязки сохраненных расстановок к пользователю
   * @returns {string} Идентификатор пользователя или 'unknown_user'
   */
  private get userId(): string {
    if (this.currentPlayer && this.currentPlayer.player_id) {
      return this.currentPlayer.player_id;
    }
    return 'unknown_user';
  }

  /**
   * Конструктор компонента
   * @constructor
   * @param {AuthService} authService - Сервис аутентификации
   * @param {Router} router - Сервис маршрутизации
   * @param {WebSocketService} webSocketService - Сервис WebSocket для многопользовательской игры
   * @param {ActivatedRoute} route - Сервис для работы с параметрами маршрута
   */
  constructor(
    private authService: AuthService,
    private router: Router,
    private webSocketService: WebSocketService,
    private route: ActivatedRoute
  ) {}

  /**
   * Инициализация компонента
   * - Загружает данные текущего пользователя
   * - Получает opponentId из query параметров
   * - Подписывается на события начала игры через WebSocket
   */
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

  /**
   * Переход на страницу игры после получения уведомления о начале
   * @private
   * @param {GameStartNotification} notification - Уведомление о начале игры
   */
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

  /**
   * Загрузка данных текущего пользователя из сервиса аутентификации
   * @description Загружает текущего пользователя и его сохраненные расстановки
   * При отсутствии авторизации перенаправляет на страницу входа
   */
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

  /**
   * Запрос на очистку игрового поля с подтверждением
   * @description Показывает попап подтверждения только если на поле есть хотя бы один корабль
   */
  requestClearBoard() {
    if (!this.hasAtLeastOneShip()) {
      return;
    }
    this.showClearConfirmation = true;
  }

  /**
   * Подтверждение очистки игрового поля
   * @description Очищает поле и закрывает попап подтверждения
   */
  confirmClear() {
    this.clearBoard();
    this.showClearConfirmation = false;
    this.showMessage('Поле очищено', 'Все корабли удалены с игрового поля');
  }

  /**
   * Отмена очистки игрового поля
   * @description Закрывает попап подтверждения без действий
   */
  cancelClear() {
    this.showClearConfirmation = false;
  }

  /**
   * Переключение ориентации корабля (горизонтальная/вертикальная)
   * @description Изменяет ориентацию для размещения новых кораблей
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
  }

  /**
   * Полная очистка игрового поля
   * @description Сбрасывает все корабли в исходное состояние (не размещены)
   */
  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
  }

  /**
   * Генерация случайной расстановки всех кораблей
   * @description Автоматически размещает все корабли согласно правилам игры
   */
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

  /**
   * Конвертация текущей расстановки в формат BoardLayoutDTO для отправки на сервер
   * @private
   * @returns {BoardLayoutDTO} Объект с данными расстановки в формате сервера
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

  /**
   * Запуск игры (устаревший метод, используется playerReady)
   * @description Проверяет, что все корабли размещены, и переходит на страницу игры
   */
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

  /**
   * Обработчик начала перетаскивания корабля
   * @param {DragEvent} event - Событие перетаскивания
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
   * Подготовка игрока к игре
   * @description Отправляет сообщение о готовности через WebSocket
   * Проверяет наличие всех необходимых данных перед отправкой
   */
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

  /**
   * Сохранение ID игрока для использования на следующей странице
   * @private
   * @param {number} playerId - Идентификатор игрока
   */
  private savePlayerIdForNextPage(playerId: number): void {
    sessionStorage.setItem('currentPlayerId', playerId.toString());
    localStorage.setItem('playerId', playerId.toString());
    console.log('Player ID сохранен для следующей страницы:', playerId);
  }

  /**
   * Отмена готовности к игре
   * @description Показывает попап подтверждения отмены готовности
   */
  cancelReady() {
    this.showCancelReadyPopup = true;
  }

  /**
   * Подтверждение отмены готовности
   * @description Сбрасывает флаг готовности и закрывает попап
   */
  confirmCancelReady() {
    this.isPlayerReady = false;
    this.showCancelReadyPopup = false;
    
    this.showMessage(
      'Готовность отменена',
      'Вы можете изменить расстановку кораблей. Окно может быть закрыто автоматически через 5 секунд или нажатием на кнопку'
    );
  }

  /**
   * Обработчик перемещения корабля над игровым полем
   * @description Вычисляет потенциальные позиции для размещения
   * @param {DragEvent} event - Событие перетаскивания
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
   * @param {DragEvent} event - Событие перетаскивания
   */
  onDragLeave(event: DragEvent) {
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  /**
   * Обработчик завершения перетаскивания - размещение корабля на поле
   * @param {DragEvent} event - Событие перетаскивания
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
   * @description Проверяет, что на поле есть хотя бы один корабль перед открытием
   */
  openSavePopup() {
    if (!this.hasAtLeastOneShip()) {
      this.showMessage('Пустая расстановка', 'Нельзя сохранить пустую расстановку! Разместите хотя бы один корабль.');
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

  /**
   * Проверка, что на поле размещен хотя бы один корабль
   * @returns {boolean} true если есть хотя бы один корабль, иначе false
   */
  hasAtLeastOneShip(): boolean {
    return this.ships.some(ship => ship.placed && ship.positions.length > 0);
  }

  /**
   * Проверка уникальности названия расстановки
   * @param {string} name - Проверяемое название
   * @returns {boolean} true если название уникально, иначе false
   */
  isPlacementNameUnique(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return !this.userPlacements.some(placement =>
      placement.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Получение количества оставшихся для размещения кораблей определенного типа
   * @param {string} type - Тип корабля
   * @returns {number} Количество неразмещенных кораблей указанного типа
   */
  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  /**
   * Проверка, что все корабли размещены на поле
   * @returns {boolean} true если все корабли размещены, иначе false
   */
  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  /**
   * Проверка валидности позиции на игровом поле
   * @param {string} row - Буква строки
   * @param {number} col - Номер столбца
   * @returns {boolean} true если позиция валидна, иначе false
   */
  isValidPosition(row: string, col: number): boolean {
    const rowIndex = this.rows.indexOf(row);
    return rowIndex >= 0 && rowIndex < this.rows.length &&
           col >= 1 && col <= this.columns.length;
  }

  /**
   * Проверка наличия корабля в указанной позиции
   * @param {string} row - Буква строки
   * @param {number} col - Номер столбца
   * @returns {boolean} true если в позиции есть корабль, иначе false
   */
  hasShip(row: string, col: number): boolean {
    return this.ships.some(ship =>
      ship.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

  /**
   * Проверка наличия соседнего корабля в смежных клетках
   * @param {string} row - Буква строки
   * @param {number} col - Номер столбца
   * @returns {boolean} true если есть соседний корабль, иначе false
   */
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

  /**
   * Проверка возможности размещения корабля в указанной позиции
   * @param {any} ship - Объект корабля (размер и тип)
   * @param {string} startRow - Начальная строка
   * @param {number} startCol - Начальный столбец
   * @returns {boolean} true если корабль можно разместить, иначе false
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
   * Проверка является ли ячейка валидной зоной для размещения корабля
   * @param {string} row - Буква строки
   * @param {number} col - Номер столбца
   * @returns {boolean} true если ячейка валидна для размещения, иначе false
   */
  isValidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
           this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  /**
   * Проверка является ли ячейка невалидной зоной для размещения корабля
   * @param {string} row - Буква строки
   * @param {number} col - Номер столбца
   * @returns {boolean} true если ячейка невалидна для размещения, иначе false
   */
  isInvalidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
           !this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  /**
   * Расчет всех позиций корабля исходя из начальной точки и ориентации
   * @param {number} size - Размер корабля
   * @param {string} startRow - Начальная строка
   * @param {number} startCol - Начальный столбец
   * @returns {Array<{row: string, col: number}>} Массив позиций корабля
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
   * @private
   * @param {number} startCol - Начальный столбец
   * @param {number} size - Размер корабля
   * @returns {boolean} true если размещать вправо, false если влево
   */
  shouldFlipHorizontal(startCol: number, size: number): boolean {
    if (startCol <= size) {
      return true; // Вправо, если у левого края
    }
    if (startCol >= this.columns.length - size + 1) {
      return false; // Влево, если у правого края
    }
    return true; // По умолчанию вправо
  }

  /**
   * Определение направления размещения для вертикальной ориентации
   * @private
   * @param {number} startRowIndex - Индекс начальной строки
   * @param {number} size - Размер корабля
   * @returns {boolean} true если размещать вниз, false если вверх
   */
  shouldFlipVertical(startRowIndex: number, size: number): boolean {
    if (startRowIndex < size) {
      return true; // Вниз, если у верхнего края
    }
    if (startRowIndex >= this.rows.length - size) {
      return false; // Вверх, если у нижнего края
    }
    return true; // По умолчанию вниз
  }

  /**
   * Размещение корабля на игровом поле
   * @param {any} ship - Объект корабля
   * @param {string} startRow - Начальная строка
   * @param {number} startCol - Начальный столбец
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
   * @param {number} size - Размер корабля
   * @param {string} type - Тип корабля
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

  /**
   * Сохранение текущей расстановки кораблей
   * @description Выполняет проверки на валидность и уникальность названия
   * Сохраняет расстановку в localStorage с привязкой к пользователю
   */
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

  /**
   * Сохранение расстановок в localStorage с привязкой к пользователю
   * @private
   */
  private saveToLocalStorage() {
    try {
      const key = `battleshipPlacements_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.userPlacements));
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
      this.showMessage('Ошибка сохранения', 'Произошла ошибка при сохранении расстановки.', false);
    }
  }

  /**
   * Загрузка пользовательских расстановок из localStorage
   */
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

  /**
   * Загрузка пользовательской расстановки из списка сохраненных
   * @param {UserPlacement} placement - Сохраненная расстановка для загрузки
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
    this.showMessage('Загрузка расстановки', `Загружена пользовательская расстановка: ${placement.name}`);
  }

  /**
   * Конвертация текущей расстановки в формат для отправки на сервер
   * @private
   * @returns {ShipPlacement[]} Массив размещений кораблей в формате сервера
   */
  private convertToServerFormat(): ShipPlacement[] {
    const serverPlacements: ShipPlacement[] = [];

    this.ships.forEach(ship => {
      if (ship.placed && ship.positions.length > 0) {
        const firstPosition = ship.positions[0];
        const lastPosition = ship.positions[ship.positions.length - 1];

        const row = this.rows.indexOf(firstPosition.row);
        const col = firstPosition.col - 1; // Конвертация в 0-based индекс

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
   * Загрузка расстановки из формата сервера (черновик)
   * @private
   * @param {ShipPlacement[]} placements - Массив размещений кораблей в формате сервера
   */
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

  /**
   * Загрузка стратегии автоматической расстановки кораблей
   * @param {string} strategy - Название стратегии ('coastal', 'diagonal', 'halfField', 'spread')
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

    this.closeLoadPopup();
    this.showMessage('Стратегия загружена', `Загружена стратегия: ${this.getStrategyName(strategy)}`);
  }

  /**
   * Получение читаемого названия стратегии по ключу
   * @private
   * @param {string} strategy - Ключ стратегии
   * @returns {string} Читаемое название стратегии
   */
  private getStrategyName(strategy: string): string {
    const strategyNames: {[key: string]: string} = {
      'coastal': 'Береговая',
      'diagonal': 'Диагональная',
      'halfField': 'Полупольная',
      'spread': 'Разброс'
    };
    return strategyNames[strategy] || strategy;
  }

  /**
   * Береговая стратегия - размещение кораблей вдоль границ поля
   * @private
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
   * @private
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
   * @private
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
   * @private
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

  /**
   * Закрытие попапа отмены готовности без действий
   */
  closeCancelReadyPopup() {
    this.showCancelReadyPopup = false;
  }

  /**
   * Показать сообщение в попапе
   * @param {string} title - Заголовок сообщения
   * @param {string} text - Текст сообщения
   * @param {boolean} autoClose - Автоматическое закрытие через 5 секунд (по умолчанию true)
   * @returns {Promise<void>} Promise, который резолвится после отображения сообщения
   */
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

  /**
   * Закрыть попап сообщения
   */
  closeMessagePopup() {
    this.showMessagePopup = false;
    this.messageTitle = '';
    this.messageText = '';
  }
}