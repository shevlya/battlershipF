import { Component, OnInit } from '@angular/core';

// Интерфейсы и типы
interface ShipType {
  size: number;
  count: number;
  name: string;
}

interface Ship {
  id: number;
  size: number;
  cells: CellPosition[];
  orientation: 'horizontal' | 'vertical';
}

interface CellPosition {
  row: number;
  col: number;
}

interface GameState {
  playerBoard: number[][];
  ships: Ship[];
  selectedShipSize: number;
  orientation: 'horizontal' | 'vertical';
  placementStrategy: string;
  placedShips: { [key: number]: number };
}

// Константы
const BOARD_SIZE = 10;
const SHIP_TYPES: ShipType[] = [
  { size: 4, count: 1, name: "Линкор" },
  { size: 3, count: 2, name: "Крейсер" },
  { size: 2, count: 3, name: "Эсминец" },
  { size: 1, count: 4, name: "Катер" }
];

@Component({
  selector: 'app-placement-page',
  standalone: true,
  imports: [],
  templateUrl: './placement-page.component.html',
  styleUrl: './placement-page.component.scss'
})
export class PlacementPageComponent implements OnInit {
  // Глобальное состояние игры
  gameState: GameState = {
    playerBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0)),
    ships: [],
    selectedShipSize: 4,
    orientation: 'horizontal',
    placementStrategy: 'manual',
    placedShips: { 4: 0, 3: 0, 2: 0, 1: 0 }
  };

  ngOnInit() {
    this.initInstructionPopup();
    this.initTooltips();
    this.initializeBoard();
    this.initializeUI();
  }

  // Инициализация игрового поля
  initializeBoard(): void {
    const boardElement = document.getElementById('playerBoard');
    if (!boardElement) return;

    boardElement.innerHTML = '';

    // Добавляем буквенные координаты (A-J)
    const letters = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    
    for (let i = 0; i <= BOARD_SIZE; i++) {
      for (let j = 0; j <= BOARD_SIZE; j++) {
        const cell = document.createElement('div');
        cell.className = 'cell';

        if (i === 0 && j === 0) {
          // Пустая угловая клетка
          cell.classList.add('coordinate');
        } else if (i === 0) {
          // Буквенные координаты
          cell.classList.add('coordinate');
          cell.textContent = letters[j];
        } else if (j === 0) {
          // Числовые координаты
          cell.classList.add('coordinate');
          cell.textContent = i.toString();
        } else {
          // Игровые клетки
          cell.classList.add('water');
          cell.dataset['row'] = (i - 1).toString();
          cell.dataset['col'] = (j - 1).toString();

          // Обработчики событий
          cell.addEventListener('click', (event) => this.handleCellClick(event));
          cell.addEventListener('mouseover', (event) => this.handleCellHover(event));
          cell.addEventListener('mouseout', (event) => this.handleCellHoverOut(event));
        }

        boardElement.appendChild(cell);
      }
    }
  }

  // Обработка клика по клетке
  handleCellClick(event: Event): void {
    if (this.gameState.placementStrategy !== 'manual') return;

    const target = event.target as HTMLElement;
    const row = parseInt(target.dataset['row'] || '');
    const col = parseInt(target.dataset['col'] || '');

    if (isNaN(row) || isNaN(col)) return;

    if (this.canPlaceShip(row, col, this.gameState.selectedShipSize, this.gameState.orientation)) {
      this.placeShip(row, col, this.gameState.selectedShipSize, this.gameState.orientation);
      this.updateShipCounters();
      this.checkGameReady();
    }
  }

  // Обработка наведения на клетку
  handleCellHover(event: Event): void {
    if (this.gameState.placementStrategy !== 'manual') return;

    const target = event.target as HTMLElement;
    const row = parseInt(target.dataset['row'] || '');
    const col = parseInt(target.dataset['col'] || '');

    if (isNaN(row) || isNaN(col)) return;

    const cells = this.getShipCells(row, col, this.gameState.selectedShipSize, this.gameState.orientation);
    const isValid = this.canPlaceShip(row, col, this.gameState.selectedShipSize, this.gameState.orientation);

    // Убираем предыдущий hover эффект
    this.clearHoverEffect();

    // Применяем новый hover эффект
    cells.forEach(cellPos => {
      const cell = document.querySelector(`.cell[data-row="${cellPos.row}"][data-col="${cellPos.col}"]`) as HTMLElement;
      if (cell) {
        if (isValid) {
          cell.classList.add('ship-hover');
        } else {
          cell.classList.add('invalid');
        }
      }
    });
  }

  // Обработка ухода курсора с клетки
  handleCellHoverOut(event: Event): void {
    this.clearHoverEffect();
  }

  // Очистка hover эффекта
  private clearHoverEffect(): void {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
      cell.classList.remove('ship-hover', 'invalid');
    });
  }

  // Получить все клетки, занимаемые кораблем
  getShipCells(row: number, col: number, size: number, orientation: string): CellPosition[] {
    const cells: CellPosition[] = [];
    for (let i = 0; i < size; i++) {
      if (orientation === 'horizontal') {
        if (col + i < BOARD_SIZE) {
          cells.push({ row: row, col: col + i });
        }
      } else {
        if (row + i < BOARD_SIZE) {
          cells.push({ row: row + i, col: col });
        }
      }
    }
    return cells;
  }

  // Проверить возможность размещения корабля
  canPlaceShip(row: number, col: number, size: number, orientation: string): boolean {
    // Проверка выхода за границы поля
    if (orientation === 'horizontal') {
      if (col + size > BOARD_SIZE) return false;
    } else {
      if (row + size > BOARD_SIZE) return false;
    }

    // Проверка доступности клеток и соседних клеток
    const cells = this.getShipCells(row, col, size, orientation);
    for (const cell of cells) {
      // Проверка самой клетки
      if (this.gameState.playerBoard[cell.row][cell.col] !== 0) return false;

      // Проверка соседних клеток (включая диагонали)
      for (let r = cell.row - 1; r <= cell.row + 1; r++) {
        for (let c = cell.col - 1; c <= cell.col + 1; c++) {
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            if (this.gameState.playerBoard[r][c] !== 0) return false;
          }
        }
      }
    }

    // Проверка лимита кораблей данного типа
    const shipType = SHIP_TYPES.find(ship => ship.size === size);
    if (!shipType || this.gameState.placedShips[size] >= shipType.count) {
      return false;
    }

    return true;
  }

  // Разместить корабль на поле
  placeShip(row: number, col: number, size: number, orientation: string): void {
    const shipId = this.gameState.ships.length + 1;
    const cells = this.getShipCells(row, col, size, orientation);

    // Обновление состояния игры
    cells.forEach(cell => {
      this.gameState.playerBoard[cell.row][cell.col] = shipId;
    });

    this.gameState.ships.push({
      id: shipId,
      size: size,
      cells: cells,
      orientation: orientation as 'horizontal' | 'vertical'
    });

    this.gameState.placedShips[size]++;

    // Визуальное отображение корабля
    this.renderBoard();
  }

  // Визуализация игрового поля
  renderBoard(): void {
    const cells = document.querySelectorAll('.cell[data-row][data-col]');

    cells.forEach(cell => {
      const row = parseInt((cell as HTMLElement).dataset['row'] || '');
      const col = parseInt((cell as HTMLElement).dataset['col'] || '');

      cell.className = 'cell water';

      if (this.gameState.playerBoard[row][col] !== 0) {
        cell.classList.add('ship');
        cell.classList.remove('water');
      }
    });
  }

  // Обновить счетчики кораблей
  updateShipCounters(): void {
    const battleshipCount = document.getElementById('battleshipCount');
    const cruiserCount = document.getElementById('cruiserCount');
    const destroyerCount = document.getElementById('destroyerCount');
    const boatCount = document.getElementById('boatCount');

    if (battleshipCount) {
      battleshipCount.textContent = (SHIP_TYPES[0].count - this.gameState.placedShips[4]).toString();
    }
    if (cruiserCount) {
      cruiserCount.textContent = (SHIP_TYPES[1].count - this.gameState.placedShips[3]).toString();
    }
    if (destroyerCount) {
      destroyerCount.textContent = (SHIP_TYPES[2].count - this.gameState.placedShips[2]).toString();
    }
    if (boatCount) {
      boatCount.textContent = (SHIP_TYPES[3].count - this.gameState.placedShips[1]).toString();
    }
  }

  // Проверить готовность к игре
  checkGameReady(): void {
    const allShipsPlaced = SHIP_TYPES.every(ship =>
      this.gameState.placedShips[ship.size] === ship.count
    );

    const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
    if (startGameBtn) {
      startGameBtn.disabled = !allShipsPlaced;
    }
  }

  // Инициализация UI
  initializeUI(): void {
    // Обработчики для выбора стратегии
    document.querySelectorAll('.strategy-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.strategy-option').forEach(opt => {
          opt.classList.remove('active');
        });
        option.classList.add('active');

        const strategy = (option as HTMLElement).dataset['strategy'] || 'manual';
        this.gameState.placementStrategy = strategy;

        // Если выбрана не ручная стратегия, показываем кнопку авторасстановки
        const autoPlaceBtn = document.getElementById('autoPlaceBtn') as HTMLButtonElement;
        if (autoPlaceBtn) {
          autoPlaceBtn.style.display = strategy === 'manual' ? 'none' : 'block';
        }
      });
    });

    // Обработчики для выбора корабля
    document.querySelectorAll('.ship-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.ship-item').forEach(ship => {
          ship.classList.remove('active');
        });
        item.classList.add('active');

        this.gameState.selectedShipSize = parseInt((item as HTMLElement).dataset['size'] || '4');
      });
    });

    // Обработчики для выбора ориентации
    document.querySelectorAll('.orientation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.orientation-btn').forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        this.gameState.orientation = (btn as HTMLElement).dataset['orientation'] as 'horizontal' | 'vertical';
      });
    });

    // Обработчики для кнопок
    const autoPlaceBtn = document.getElementById('autoPlaceBtn');
    if (autoPlaceBtn) {
      autoPlaceBtn.addEventListener('click', () => {
        this.autoPlaceShips();
      });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearBoard();
        this.updateShipCounters();
      });
    }

    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        alert('Игра начинается! Все корабли расставлены.');
        // Здесь будет переход к основной игровой логике
      });
    }
  }

  // Автоматическая расстановка кораблей
  autoPlaceShips(): void {
    if (this.gameState.placementStrategy === 'manual') return;

    // Очистка текущего поля
    this.clearBoard();

    // В зависимости от стратегии используем разные алгоритмы
    switch(this.gameState.placementStrategy) {
      case 'random':
        this.placeShipsRandomly();
        break;
      case 'coastal':
        this.placeShipsCoastal();
        break;
      case 'diagonal':
        this.placeShipsDiagonal();
        break;
      case 'half-field':
        this.placeShipsHalfField();
        break;
      default:
        this.placeShipsRandomly();
    }

    this.updateShipCounters();
    this.checkGameReady();
    this.renderBoard();
  }

  // Случайная расстановка кораблей
  private placeShipsRandomly(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        this.placeShipRandomly(shipType.size);
      }
    }
  }

  // Береговая стратегия
  private placeShipsCoastal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          const isBorder = Math.random() > 0.3;
          let row = 0, col = 0;

          if (isBorder) {
            const side = Math.floor(Math.random() * 4);
            switch(side) {
              case 0: row = 0; col = Math.floor(Math.random() * BOARD_SIZE); break;
              case 1: row = Math.floor(Math.random() * BOARD_SIZE); col = BOARD_SIZE - 1; break;
              case 2: row = BOARD_SIZE - 1; col = Math.floor(Math.random() * BOARD_SIZE); break;
              case 3: row = Math.floor(Math.random() * BOARD_SIZE); col = 0; break;
            }
          } else {
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * BOARD_SIZE);
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (this.canPlaceShip(row, col, shipType.size, orientation)) {
            this.placeShip(row, col, shipType.size, orientation);
            placed = true;
          }
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Диагональная стратегия
  private placeShipsDiagonal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          const row = Math.floor(Math.random() * BOARD_SIZE);
          const col = Math.floor(Math.random() * BOARD_SIZE);

          if (row === col || row + col === BOARD_SIZE - 1) {
            attempts++;
            continue;
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (this.canPlaceShip(row, col, shipType.size, orientation)) {
            this.placeShip(row, col, shipType.size, orientation);
            placed = true;
          }
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Полупольная стратегия
  private placeShipsHalfField(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    const half = Math.random() > 0.5 ? 'left' : 'right';

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          let row = 0, col = 0;

          if (half === 'left') {
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * (BOARD_SIZE / 2));
          } else {
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + Math.floor(BOARD_SIZE / 2);
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (this.canPlaceShip(row, col, shipType.size, orientation)) {
            this.placeShip(row, col, shipType.size, orientation);
            placed = true;
          }
          attempts++;
        }

        if (!placed) {
          this.placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Размещение одного корабля случайным образом
  private placeShipRandomly(size: number): void {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 1000) {
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

      if (this.canPlaceShip(row, col, size, orientation)) {
        this.placeShip(row, col, size, orientation);
        placed = true;
      }
      attempts++;
    }
  }

  // Очистка игрового поля
  clearBoard(): void {
    this.gameState.playerBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    this.gameState.ships = [];
    this.gameState.placedShips = { 4: 0, 3: 0, 2: 0, 1: 0 };

    const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
    if (startGameBtn) {
      startGameBtn.disabled = true;
    }

    this.renderBoard();
  }

  // Для попапа с инфой
  initInstructionPopup() {
    const instructionTrigger = document.getElementById('instructionTrigger');
    const instructionPopup = document.getElementById('instructionPopup');
    const popupOverlay = document.getElementById('popupOverlay');
    const popupClose = document.getElementById('popupClose');
    const popupUnderstand = document.getElementById('popupUnderstand');

    const openPopup = () => {
      instructionPopup?.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closePopup = () => {
      instructionPopup?.classList.remove('active');
      document.body.style.overflow = '';
    };

    instructionTrigger?.addEventListener('click', openPopup);
    popupOverlay?.addEventListener('click', closePopup);
    popupClose?.addEventListener('click', closePopup);
    popupUnderstand?.addEventListener('click', closePopup);

    // Закрытие по ESC
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && instructionPopup?.classList.contains('active')) {
        closePopup();
      }
    });
  }

  // Для инициализации тултипов
  initTooltips() {
    // Тултипы работают через CSS, но можно добавить дополнительную логику если нужно
    const tooltipIcons = document.querySelectorAll('.tooltip-icon');
    tooltipIcons.forEach(icon => {
      // Добавляем обработчики для дополнительной функциональности
      icon.addEventListener('click', (event) => {
        event.stopPropagation(); // Предотвращаем всплытие события
      });
    });
  }
}