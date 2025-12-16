import { Component } from '@angular/core';
import { DatePipe, CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router, ActivatedRoute} from '@angular/router';
import {AuthService} from '../../services/auth.service';
import {WebSocketService, GameStartNotification} from '../../services/webSocket.service';

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
  matrix: string[][];  // Character[][] в Java эквивалентен string[][] в TypeScript
}
// В начало файла, после других интерфейсов
interface GameConfig {
  gameId: number;
  playerId: number;
  difficulty?: string;     // Для одиночной игры
  opponentId?: number;     // Для мультиплеера
  gameType: 'SINGLE_PLAYER' | 'MULTIPLAYER';
  ships: ShipPlacement[];
}

interface WebSocketConfig {
  playerId: number;
  opponentId: number;
  gameType: string;
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
 * Компонент для расстановки кораблей перед началом игры в морской бой
 *
 * Основные функции:
 * - Drag & Drop расстановка кораблей
 * - Сохранение/загрузка пользовательских расстановок
 * - Автоматическая расстановка по различным стратегиям
 * - Валидация правильности расстановки
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
  showCancelReadyPopup = false;
  showMessagePopup = false; //для замены alert потом



  /** Данные для попапа сообщения замены alert */
  messageTitle = '';
  messageText = '';

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

  isPlayerReady = false;
  opponentId: number | null = null; // ID оппонента, нужно будет получить при входе на страницу
  gameId: number | null = null;
  /** Уровень сложности для игры с ИИ */
  difficulty: string = 'captain';

    /** Конфигурация игры */
  gameConfig: GameConfig | null = null;

  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;
  // В класс компонента добавить:
  gameType: 'SINGLE_PLAYER' | 'MULTIPLAYER' = 'SINGLE_PLAYER';

  /**
   * Геттер для получения ID текущего пользователя
   * Используется для привязки сохраненных расстановок к пользователю
   */
  private get userId(): string {
    if (this.currentPlayer && this.currentPlayer.player_id) {
      return this.currentPlayer.player_id;
    }
    return 'unknown_user';
  }

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly webSocketService: WebSocketService,
    private readonly route: ActivatedRoute
  ) {}

  /**
   * Инициализация компонента
   * Загружает данные текущего пользователя и его сохраненные расстановки
   */

  // Обновить ngOnInit():
  ngOnInit() {
    this.loadCurrentPlayer();

    // Получаем параметры из URL
    this.route.queryParams.subscribe(params => {
      console.log('Параметры URL в placement:', params);

      // Сначала проверяем явный параметр gameType
      if (params['gameType']) {
        this.gameType = params['gameType'] as 'SINGLE_PLAYER' | 'MULTIPLAYER';

        if (this.gameType === 'MULTIPLAYER' && params['opponentId']) {
          this.opponentId = +params['opponentId'];
          console.log('Мультиплеер: ID оппонента:', this.opponentId);
          this.connectToWebSocket();
        } else if (this.gameType === 'SINGLE_PLAYER' && params['difficulty']) {
          this.difficulty = params['difficulty'];
          console.log('Одиночная игра: уровень сложности:', this.difficulty);
        }
      }
      // Для обратной совместимости - определяем по наличию opponentId
      else if (params['opponentId']) {
        this.gameType = 'MULTIPLAYER';
        this.opponentId = +params['opponentId'];
        console.log('Мультиплеер (совместимость): ID оппонента:', this.opponentId);
        this.connectToWebSocket();
      }
      else if (params['difficulty']) {
        this.gameType = 'SINGLE_PLAYER';
        this.difficulty = params['difficulty'];
        console.log('Одиночная игра (совместимость): уровень сложности:', this.difficulty);
      }
      // Если нет параметров, проверяем state
      else {
        const navigation = window.history.state;
        if (navigation && navigation.difficulty) {
          this.gameType = 'SINGLE_PLAYER';
          this.difficulty = navigation.difficulty;
          console.log('Одиночная игра (из state):', this.difficulty);
        } else {
          console.error('Не удалось определить режим игры!');
          // Показываем пользователю ошибку
          this.showMessage('Ошибка', 'Не удалось определить режим игры. Пожалуйста, вернитесь в лобби и выберите режим игры заново.');
        }
      }

      console.log('Определен режим игры:', this.gameType);
    });
  }

  playerReady() {
    if (!this.isAllShipsPlaced()) {
      this.showMessage('Внимание', 'Разместите все корабли перед началом игры!');
      return;
    }

    // Проверяем, что режим игры определен
    if (!this.gameType) {
      this.showMessage('Ошибка', 'Не удалось определить режим игры. Перезагрузите страницу.');
      return;
    }

    const playerId = this.currentPlayer?.player_id;
    if (!playerId) {
      this.showMessage('Ошибка', 'Не удалось определить ваш ID. Пожалуйста, перезагрузите страницу.');
      return;
    }

    // Сохраняем playerId для следующей страницы
    this.savePlayerIdForNextPage(playerId);

    if (this.gameType === 'SINGLE_PLAYER') {
      this.startSinglePlayerGame();
    } else if (this.gameType === 'MULTIPLAYER') {
      this.startMultiplayerGame();
    }
  }


// Метод подключения к WebSocket (только для мультиплеера):
  private async connectToWebSocket() {
    const playerId = this.currentPlayer?.player_id;
    if (!playerId) {
      console.error('Не удалось получить playerId для подключения к WebSocket');
      return;
    }

    try {
      if (!this.webSocketService.isConnected()) {
        console.log('Подключение к WebSocket для мультиплеера...');
        await this.webSocketService.connect(playerId);
        console.log('Успешно подключено к WebSocket');
      }

      // Подписываемся на события начала игры только для мультиплеера
      this.webSocketService.subscribeToGameStartDirect((notification) => {
        console.log('Получено уведомление о начале игры (мультиплеер):', notification);

        if (notification.gameId) {
          const playerId = this.currentPlayer?.player_id;

          const queryParams = {
            gameId: notification.gameId,
            playerId: playerId,
            opponentId: notification.opponentId,
            gameType: 'MULTIPLAYER'
          };

          console.log('Переход на мультиплеерную игру:', queryParams);

          this.router.navigate(['/two-players-field', notification.gameId], {
            queryParams: queryParams
          });
        }
      });

    } catch (error) {
      console.error('Ошибка подключения к WebSocket:', error);
      alert('Не удалось подключиться к серверу. Пожалуйста, проверьте интернет-соединение.');
    }
  }
  private initializeWebSocket() {
    // Здесь будет инициализация WebSocket
    console.log('Инициализация WebSocket для мультиплеера');
    // this.webSocketService.connect();
    // this.webSocketService.subscribeToGameStart(...);
  }

  private navigateToGamePage(notification: GameStartNotification): void {
    const playerId = this.currentPlayer?.player_id;

    if (!playerId) {
      console.error('Player ID не найден для навигации');
      return;
    }

    // Подготавливаем данные для передачи
    const queryParams = {
      gameId: notification.gameId,
      playerId: playerId,
      opponentId: notification.opponentId
    };

    console.log('Переход на страницу игры с параметрами:', queryParams);

    // Переход на страницу игры с передачей параметров
    this.router.navigate(['/two-players-field', notification.gameId], {
      queryParams: queryParams
    });
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

    // Сохраняем playerId сразу для использования во всем приложении
    if (this.currentPlayer.player_id) {
      this.savePlayerIdForNextPage(this.currentPlayer.player_id);
    }

    this.loadUserPlacements();
  }

  // ==================== МЕТОДЫ УПРАВЛЕНИЯ ИГРОВЫМ ПОЛЕМ ====================

  /**
   * Запрос на очистку игрового поля с подтверждением
   * Запрещает очистку пустого поля
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
   * Переключение ориентации корабля (горизонтальная/вертикальная)
   */
  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
  }

  /**
   * Полная очистка игрового поля - сбрасывает все корабли в исходное состояние
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
// Метод для конвертации расстановки в формат BoardLayoutDTO
  private convertToBoardLayoutDTO(): BoardLayoutDTO {
    // Создаем матрицу 10x10, заполненную пробелами
    const matrix: string[][] = Array(10).fill(null).map(() => Array(10).fill(' '));

    // Заполняем матрицу кораблями
    this.ships.forEach(ship => {
      if (ship.placed) {
        ship.positions.forEach(pos => {
          const rowIndex = this.rows.indexOf(pos.row);
          const colIndex = pos.col - 1; // конвертируем в 0-based индекс

          if (rowIndex >= 0 && rowIndex < 10 && colIndex >= 0 && colIndex < 10) {
            matrix[rowIndex][colIndex] = 'S'; // 'S' для обозначения корабля
          }
        });
      }
    });

    // Подготавливаем данные о кораблях в формате ShipPlacement
    const ships = this.convertToServerFormat();

    return {
      ships: ships,
      matrix: matrix
    };
  }
  /**
   * Запуск игры после успешной расстановки всех кораблей
   * Проверяет, что все корабли размещены, и конвертирует данные для отправки на сервер - единый метод для обоих режимов
   */
  startGame() {
    if (!this.isAllShipsPlaced()) {
      this.showMessage('Внимание', 'Разместите все корабли перед началом игры!');
      return;
    }

    if (this.gameType === 'MULTIPLAYER') {
      this.startMultiplayerGame();
    } else {
      this.startSinglePlayerGame();
    }
  }

  /**
   * Запуск одиночной игры
   */
  private startSinglePlayerGame() {
    console.log('Запуск одиночной игры');
    const serverFormat = this.convertToServerFormat();

    const gameId = Date.now();
    const playerId = this.currentPlayer?.id || 0;

    const gameConfig: GameConfig = {
      gameId: gameId,
      playerId: playerId,
      difficulty: this.difficulty,
      gameType: 'SINGLE_PLAYER',
      ships: serverFormat
    };

    this.saveGameConfig(gameConfig);

    this.router.navigate(['/two-players-field', gameId], {
      queryParams: {
        gameId: gameId,
        playerId: playerId,
        difficulty: this.difficulty,
        gameType: 'SINGLE_PLAYER'
      }
    });
  }
  /**
   * Сохранение конфигурации игры
   */
  private saveGameConfig(config: GameConfig) {
    sessionStorage.setItem('gameConfig', JSON.stringify(config));
    localStorage.setItem('lastGameConfig', JSON.stringify(config));
    console.log('Сохранена конфигурация игры:', config);
  }

  /**
   * Проверка готовности к мультиплееру
   */
  isMultiplayerReady(): boolean {
    return this.gameType === 'MULTIPLAYER' && this.isPlayerReady;
  }

  /**
   * Запуск многопользовательской игры
   */
  private startMultiplayerGame() {
    console.log('Запуск многопользовательской игры');

    if (!this.opponentId) {
      this.showMessage('Ошибка', 'ID оппонента не найден');
      return;
    }

    const playerId = this.currentPlayer?.id;
    if (!playerId) {
      this.showMessage('Ошибка', 'Не удалось определить ваш ID');
      return;
    }

    // Для мультиплеера используем WebSocket
    const serverFormat = this.convertToServerFormat();

    // TODO: Отправка через WebSocket
    // const message = {
    //   type: 'PLAYER_READY',
    //   playerId: playerId,
    //   opponentId: this.opponentId,
    //   ships: serverFormat
    // };
    // this.webSocketService.send(message);

    // Временно сохраняем в sessionStorage
    const gameId = Date.now();
    const gameConfig: GameConfig = {
      gameId: gameId,
      playerId: playerId,
      opponentId: this.opponentId,
      gameType: 'MULTIPLAYER',
      ships: serverFormat
    };

    this.saveGameConfig(gameConfig);
    this.isPlayerReady = true;

    this.showMessage(
      'Ожидание оппонента',
      'Вы готовы к игре. Ожидаем, когда оппонент разместит свои корабли...'
    );
  }

  // ==================== МЕТОДЫ DRAG & DROP ====================

  /**
   * Обработчик начала перетаскивания корабля
   * @param event - Событие перетаскивания
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


  private savePlayerIdForNextPage(playerId: number): void {
    // Сохраняем в sessionStorage для использования на следующей странице
    sessionStorage.setItem('currentPlayerId', playerId.toString());
    // Также сохраняем в глобальной переменной
    localStorage.setItem('playerId', playerId.toString());

    console.log('Player ID сохранен для следующей страницы:', playerId);
  }

  cancelReady() {
    this.showCancelReadyPopup = true;
  }

  /**
   * Подтверждение отмены готовности
   */
  confirmCancelReady() {
    this.isPlayerReady = false;
    this.showCancelReadyPopup = false;

    this.showMessage(
      'Готовность отменена',
      'Вы можете изменить расстановку кораблей. Окно может быть закрыто автоматически через 5 секунд или нажатием на кнопку'
    );
    // Можно добавить отправку сообщения об отмене готовности на сервер
  }

  /**
   * Показать сообщение в попапе
   */
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

  /**
   * Закрыть попап сообщения
   */
  closeMessagePopup() {
    this.showMessagePopup = false;
  }

  /**
   * Закрытие попапа отмены готовности без действий
   */
  closeCancelReadyPopup() {
    this.showCancelReadyPopup = false;
  }
  /**
   * Обработчик перемещения корабля над игровым полем
   * Вычисляет потенциальные позиции для размещения
   * @param event - Событие перетаскивания
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
   * @param event - Событие перетаскивания
   */
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
   * Проверяет, что на поле есть хотя бы один корабль
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

  // ==================== МЕТОДЫ ПРОВЕРКИ И ВАЛИДАЦИИ ====================

  /**
   * Проверка, что на поле размещен хотя бы один корабль
   * @returns true если есть хотя бы один корабль, иначе false
   */
  hasAtLeastOneShip(): boolean {
    return this.ships.some(ship => ship.placed && ship.positions.length > 0);
  }

  /**
   * Проверка уникальности названия расстановки
   * @param name - Проверяемое название
   * @returns true если название уникально, иначе false
   */
  isPlacementNameUnique(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return !this.userPlacements.some(placement =>
      placement.name.toLowerCase() === normalizedName
    );
  }

  /**
   * Получение количества оставшихся для размещения кораблей определенного типа
   * @param type - Тип корабля
   * @returns Количество неразмещенных кораблей указанного типа
   */
  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  /**
   * Проверка, что все корабли размещены на поле
   * @returns true если все корабли размещены, иначе false
   */
  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  /**
   * Проверка валидности позиции на игровом поле
   * @param row - Буква строки
   * @param col - Номер столбца
   * @returns true если позиция валидна, иначе false
   */
  isValidPosition(row: string, col: number): boolean {
    const rowIndex = this.rows.indexOf(row);
    return rowIndex >= 0 && rowIndex < this.rows.length &&
      col >= 1 && col <= this.columns.length;
  }

  /**
   * Проверка наличия корабля в указанной позиции
   * @param row - Буква строки
   * @param col - Номер столбца
   * @returns true если в позиции есть корабль, иначе false
   */
  hasShip(row: string, col: number): boolean {
    return this.ships.some(ship =>
      ship.positions.some(pos => pos.row === row && pos.col === col)
    );
  }

  /**
   * Проверка наличия соседнего корабля в смежных клетках
   * @param row - Буква строки
   * @param col - Номер столбца
   * @returns true если есть соседний корабль, иначе false
   */
  hasAdjacentShip(row: string, col: number): boolean {
    const directions = [
      { r: -1, c: 0 },  // сверху
      { r: 1, c: 0 },   // снизу
      { r: 0, c: -1 },  // слева
      { r: 0, c: 1 },   // справа
      { r: -1, c: -1 }, // сверху-слева
      { r: -1, c: 1 },  // сверху-справа
      { r: 1, c: -1 },  // снизу-слева
      { r: 1, c: 1 }    // снизу-справа
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
   * @param ship - Объект корабля
   * @param startRow - Начальная строка
   * @param startCol - Начальный столбец
   * @returns true если корабль можно разместить, иначе false
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
   * @param row - Буква строки
   * @param col - Номер столбца
   * @returns true если ячейка валидна для размещения, иначе false
   */
  isValidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  /**
   * Проверка является ли ячейка невалидной зоной для размещения корабля
   * @param row - Буква строки
   * @param col - Номер столбца
   * @returns true если ячейка невалидна для размещения, иначе false
   */
  isInvalidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;

    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
      !this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  // ==================== МЕТОДЫ РАСЧЕТА ПОЗИЦИЙ ====================

  /**
   * Расчет всех позиций корабля исходя из начальной точки и ориентации
   * @param size - Размер корабля
   * @param startRow - Начальная строка
   * @param startCol - Начальный столбец
   * @returns Массив позиций корабля
   */
  getShipPositions(size: number, startRow: string, startCol: number): { row: string, col: number }[] {
    const positions = [];
    const startRowIndex = this.rows.indexOf(startRow);

    if (this.isHorizontal) {
      const shouldFlip = this.shouldFlipHorizontal(startCol, size);

      if (shouldFlip) {
        // Размещение вправо от начальной точки
        for (let i = 0; i < size; i++) {
          positions.push({
            row: startRow,
            col: startCol + i
          });
        }
      } else {
        // Размещение влево от начальной точки
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
        // Размещение вниз от начальной точки
        for (let i = 0; i < size; i++) {
          if (startRowIndex + i < this.rows.length) {
            positions.push({
              row: this.rows[startRowIndex + i],
              col: startCol
            });
          }
        }
      } else {
        // Размещение вверх от начальной точки
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
   * @param startCol - Начальный столбец
   * @param size - Размер корабля
   * @returns true если размещать вправо, false если влево
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
   * @param startRowIndex - Индекс начальной строки
   * @param size - Размер корабля
   * @returns true если размещать вниз, false если вверх
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

  // ==================== МЕТОДЫ РАЗМЕЩЕНИЯ КОРАБЛЕЙ ====================

  /**
   * Размещение корабля на игровом поле
   * @param ship - Объект корабля
   * @param startRow - Начальная строка
   * @param startCol - Начальный столбец
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
   * @param size - Размер корабля
   * @param type - Тип корабля
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

  // ==================== МЕТОДЫ СОХРАНЕНИЯ И ЗАГРУЗКИ ====================

  /**
   * Сохранение текущей расстановки кораблей
   * Выполняет проверки на валидность и уникальность названия
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

    // Проверка уникальности названия
    if (!this.isPlacementNameUnique(trimmedName)) {
      alert('Расстановка с таким названием уже существует! Выберите другое название.');
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

    alert(`Расстановка "${newPlacement.name}" успешно сохранена!`);
    console.log('Сохраненная расстановка:', newPlacement);
  }

  /**
   * Сохранение расстановок в localStorage с привязкой к пользователю
   */
  private saveToLocalStorage() {
    try {
      const key = `battleshipPlacements_${this.userId}`;
      localStorage.setItem(key, JSON.stringify(this.userPlacements));
    } catch (error) {
      console.error('Ошибка при сохранении в localStorage:', error);
      alert('Произошла ошибка при сохранении расстановки.');
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
   * @param placement - Сохраненная расстановка для загрузки
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
   * Конвертация текущей расстановки в формат для отправки на сервер
   * @returns Массив размещений кораблей в формате сервера
   */
  private convertToServerFormat(): ShipPlacement[] {
    const serverPlacements: ShipPlacement[] = [];

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
   * Загрузка расстановки из формата сервера (черновик)
   * @param placements - Массив размещений кораблей в формате сервера
   */
  private loadFromServerFormat(placements: ShipPlacement[]) {
    this.clearBoard();

    placements.forEach(serverPlacement => {
      const ship = this.ships.find(s => s.id === serverPlacement.shipId);
      if (ship) {
        const positions: { row: string; col: number }[] = [];

        for (let i = 0; i < serverPlacement.size; i++) {
          const rowIndex = serverPlacement.row + (serverPlacement.vertical ? i : 0);
          const col = serverPlacement.col + (serverPlacement.vertical ? 0 : i) + 1; // Конвертация обратно в 1-based

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

  // ==================== СТРАТЕГИИ АВТОМАТИЧЕСКОЙ РАССТАНОВКИ ====================

  /**
   * Загрузка стратегии автоматической расстановки кораблей
   * @param strategy - Название стратегии ('coastal', 'diagonal', 'halfField', 'spread')
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
              case 0: // Верхняя граница
                row = this.rows[0];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 1: // Правая граница
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = BOARD_SIZE;
                break;
              case 2: // Нижняя граница
                row = this.rows[BOARD_SIZE - 1];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 3: // Левая граница
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = 1;
                break;
            }
          } else {
            // Прибрежная зона (2 клетки от границы)
            const borderZone = 2;
            const randomBorder = Math.floor(Math.random() * 4);
            switch(randomBorder) {
              case 0: // Верхняя прибрежная зона
                row = this.rows[Math.floor(Math.random() * borderZone)];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 1: // Правая прибрежная зона
                row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
                col = BOARD_SIZE - Math.floor(Math.random() * borderZone);
                break;
              case 2: // Нижняя прибрежная зона
                row = this.rows[BOARD_SIZE - 1 - Math.floor(Math.random() * borderZone)];
                col = Math.floor(Math.random() * BOARD_SIZE) + 1;
                break;
              case 3: // Левая прибрежная зона
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
            // Главная диагональ (сверху-слева направо-вниз)
            rowIndex = Math.floor(Math.random() * (BOARD_SIZE - shipType.size + 1));
            const diagonalOffset = Math.floor(Math.random() * 3) - 1;
            row = this.rows[rowIndex];
            col = rowIndex + 1 + diagonalOffset;
          } else {
            // Побочная диагональ (сверху-справа налево-вниз)
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
            // Вертикальное разделение поля
            if (half === 'first') {
              // Левая половина
              row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
              col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + 1;
            } else {
              // Правая половина
              row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
              col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + Math.floor(BOARD_SIZE / 2) + 1;
            }
          } else {
            // Горизонтальное разделение поля
            if (half === 'first') {
              // Верхняя половина
              row = this.rows[Math.floor(Math.random() * (BOARD_SIZE / 2))];
              col = Math.floor(Math.random() * BOARD_SIZE) + 1;
            } else {
              // Нижняя половина
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

          // Поиск позиции, не находящейся на границе, в центре или диагонали
          while (!isValidPosition && attempts < 100) {
            row = this.rows[Math.floor(Math.random() * BOARD_SIZE)];
            col = Math.floor(Math.random() * BOARD_SIZE) + 1;

            const rowIndex = this.rows.indexOf(row);
            const isBorder = rowIndex === 0 || rowIndex === BOARD_SIZE - 1 || col === 1 || col === BOARD_SIZE;
            const isCenter = rowIndex >= 3 && rowIndex <= 6 && col >= 4 && col <= 7;
            const isDiagonal = rowIndex === col - 1 || rowIndex + col - 1 === BOARD_SIZE - 1;

            isValidPosition = !isBorder && !isCenter && !isDiagonal;
            if (Math.random() > 0.2) {
              isValidPosition = true; // 20% шанс разместить в любой позиции
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
