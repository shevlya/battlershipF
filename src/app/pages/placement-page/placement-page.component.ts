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

//Константы
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

export class PlacementPageComponent {
  // Глобальное состояние игры
  gameState: GameState = {
    playerBoard: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0)),
    ships: [],
    selectedShipSize: 4,
    orientation: 'horizontal',
    placementStrategy: 'manual',
    placedShips: { 4: 0, 3: 0, 2: 0, 1: 0 }
  };

  /*
  // Инициализация игрового поля
  function initializeBoard(): void {
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
          cell.dataset.row = (i - 1).toString();
          cell.dataset.col = (j - 1).toString();

          // Обработчик клика для ручного размещения
          cell.addEventListener('click', handleCellClick);
          cell.addEventListener('mouseover', handleCellHover);
          cell.addEventListener('mouseout', handleCellHoverOut);
        }

        boardElement.appendChild(cell);
      }
    }

    updateShipCounters();
  }

  // Обработка клика по клетке
  function handleCellClick(event: Event): void {
    if (gameState.placementStrategy !== 'manual') return;

    const target = event.target as HTMLElement;
    const row = parseInt(target.dataset.row || '');
    const col = parseInt(target.dataset.col || '');

    if (isNaN(row) || isNaN(col)) return;

    if (canPlaceShip(row, col, gameState.selectedShipSize, gameState.orientation)) {
      placeShip(row, col, gameState.selectedShipSize, gameState.orientation);
      updateShipCounters();
      checkGameReady();
    }
  }

  // Обработка наведения на клетку
  function handleCellHover(event: Event): void {
    if (gameState.placementStrategy !== 'manual') return;

    const target = event.target as HTMLElement;
    const row = parseInt(target.dataset.row || '');
    const col = parseInt(target.dataset.col || '');

    if (isNaN(row) || isNaN(col)) return;

    const cells = getShipCells(row, col, gameState.selectedShipSize, gameState.orientation);
    const isValid = canPlaceShip(row, col, gameState.selectedShipSize, gameState.orientation);

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
  function handleCellHoverOut(event: Event): void {
    const target = event.target as HTMLElement;
    const row = parseInt(target.dataset.row || '');
    const col = parseInt(target.dataset.col || '');

    if (isNaN(row) || isNaN(col)) return;

    const cells = getShipCells(row, col, gameState.selectedShipSize, gameState.orientation);

    cells.forEach(cellPos => {
      const cell = document.querySelector(`.cell[data-row="${cellPos.row}"][data-col="${cellPos.col}"]`) as HTMLElement;
      if (cell) {
        cell.classList.remove('ship-hover', 'invalid');
      }
    });
  }

  // Получить все клетки, занимаемые кораблем
  function getShipCells(row: number, col: number, size: number, orientation: string): CellPosition[] {
    const cells: CellPosition[] = [];
    for (let i = 0; i < size; i++) {
      if (orientation === 'horizontal') {
        cells.push({ row: row, col: col + i });
      } else {
        cells.push({ row: row + i, col: col });
      }
    }
    return cells;
  }

  // Проверить возможность размещения корабля
  function canPlaceShip(row: number, col: number, size: number, orientation: string): boolean {
    // Проверка выхода за границы поля
    if (orientation === 'horizontal') {
      if (col + size > BOARD_SIZE) return false;
    } else {
      if (row + size > BOARD_SIZE) return false;
    }

    // Проверка доступности клеток и соседних клеток
    const cells = getShipCells(row, col, size, orientation);
    for (const cell of cells) {
      // Проверка самой клетки
      if (gameState.playerBoard[cell.row][cell.col] !== 0) return false;

      // Проверка соседних клеток (включая диагонали)
      for (let r = cell.row - 1; r <= cell.row + 1; r++) {
        for (let c = cell.col - 1; c <= cell.col + 1; c++) {
          if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
            if (gameState.playerBoard[r][c] !== 0) return false;
          }
        }
      }
    }

    // Проверка лимита кораблей данного типа
    const shipType = SHIP_TYPES.find(ship => ship.size === size);
    if (!shipType || gameState.placedShips[size] >= shipType.count) {
      return false;
    }

    return true;
  }

  // Разместить корабль на поле
  function placeShip(row: number, col: number, size: number, orientation: string): void {
    const shipId = gameState.ships.length + 1;
    const cells = getShipCells(row, col, size, orientation);

    // Обновление состояния игры
    cells.forEach(cell => {
      gameState.playerBoard[cell.row][cell.col] = shipId;
    });

    gameState.ships.push({
      id: shipId,
      size: size,
      cells: cells,
      orientation: orientation as 'horizontal' | 'vertical'
    });

    gameState.placedShips[size]++;

    // Визуальное отображение корабля
    cells.forEach(cell => {
      const cellElement = document.querySelector(`.cell[data-row="${cell.row}"][data-col="${cell.col}"]`) as HTMLElement;
      if (cellElement) {
        cellElement.classList.add('ship');
        cellElement.classList.remove('water', 'ship-hover', 'invalid');
      }
    });
  }

  // Обновить счетчики кораблей
  function updateShipCounters(): void {
    const battleshipCount = document.getElementById('battleshipCount');
    const cruiserCount = document.getElementById('cruiserCount');
    const destroyerCount = document.getElementById('destroyerCount');
    const boatCount = document.getElementById('boatCount');

    if (battleshipCount) {
      battleshipCount.textContent = (SHIP_TYPES[0].count - gameState.placedShips[4]).toString();
    }
    if (cruiserCount) {
      cruiserCount.textContent = (SHIP_TYPES[1].count - gameState.placedShips[3]).toString();
    }
    if (destroyerCount) {
      destroyerCount.textContent = (SHIP_TYPES[2].count - gameState.placedShips[2]).toString();
    }
    if (boatCount) {
      boatCount.textContent = (SHIP_TYPES[3].count - gameState.placedShips[1]).toString();
    }
  }

  // Проверить готовность к игре
  function checkGameReady(): void {
    const allShipsPlaced = SHIP_TYPES.every(ship =>
      gameState.placedShips[ship.size] === ship.count
    );

    const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
    if (startGameBtn) {
      startGameBtn.disabled = !allShipsPlaced;
    }
  }

  // Автоматическая расстановка кораблей
  function autoPlaceShips(strategy: string): void {
    // Очистка текущего поля
    clearBoard();

    // В зависимости от стратегии используем разные алгоритмы
    switch(strategy) {
      case 'random':
        placeShipsRandomly();
        break;
      case 'coastal':
        placeShipsCoastal();
        break;
      case 'diagonal':
        placeShipsDiagonal();
        break;
      case 'half-field':
        placeShipsHalfField();
        break;
      default:
        placeShipsRandomly();
    }

    updateShipCounters();
    checkGameReady();
    renderBoard();
  }

  // Случайная расстановка кораблей
  function placeShipsRandomly(): void {
    const shipTypes = [...SHIP_TYPES];

    // Размещаем корабли от самых больших к самым маленьким
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          const row = Math.floor(Math.random() * BOARD_SIZE);
          const col = Math.floor(Math.random() * BOARD_SIZE);
          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (canPlaceShip(row, col, shipType.size, orientation)) {
            placeShip(row, col, shipType.size, orientation);
            placed = true;
          }

          attempts++;
        }

        if (!placed) {
          console.error(`Не удалось разместить корабль размером ${shipType.size}`);
        }
      }
    }
  }

  // Береговая стратегия (корабли вдоль границ)
  function placeShipsCoastal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          // Предпочтение отдаем граничным клеткам
          const isBorder = Math.random() > 0.3;
          let row = 0, col = 0;

          if (isBorder) {
            // Выбираем граничную клетку
            const side = Math.floor(Math.random() * 4); // 0: верх, 1: право, 2: низ, 3: лево
            switch(side) {
              case 0: // Верх
                row = 0;
                col = Math.floor(Math.random() * BOARD_SIZE);
                break;
              case 1: // Право
                row = Math.floor(Math.random() * BOARD_SIZE);
                col = BOARD_SIZE - 1;
                break;
              case 2: // Низ
                row = BOARD_SIZE - 1;
                col = Math.floor(Math.random() * BOARD_SIZE);
                break;
              case 3: // Лево
                row = Math.floor(Math.random() * BOARD_SIZE);
                col = 0;
                break;
            }
          } else {
            // Иногда размещаем и в центре
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * BOARD_SIZE);
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (canPlaceShip(row, col, shipType.size, orientation)) {
            placeShip(row, col, shipType.size, orientation);
            placed = true;
          }

          attempts++;
        }

        if (!placed) {
          // Если не удалось разместить по стратегии, пробуем случайно
          placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Диагональная стратегия (избегание диагоналей)
  function placeShipsDiagonal(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          const row = Math.floor(Math.random() * BOARD_SIZE);
          const col = Math.floor(Math.random() * BOARD_SIZE);

          // Избегаем главных диагоналей
          if (row === col || row + col === BOARD_SIZE - 1) {
            attempts++;
            continue;
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (canPlaceShip(row, col, shipType.size, orientation)) {
            placeShip(row, col, shipType.size, orientation);
            placed = true;
          }

          attempts++;
        }

        if (!placed) {
          placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Полупольная стратегия (концентрация в одной половине)
  function placeShipsHalfField(): void {
    const shipTypes = [...SHIP_TYPES];
    shipTypes.sort((a, b) => b.size - a.size);

    // Выбираем случайную половину (левая/правая или верхняя/нижняя)
    const half = Math.random() > 0.5 ? 'left' : 'right';

    for (const shipType of shipTypes) {
      for (let i = 0; i < shipType.count; i++) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 1000) {
          let row = 0, col = 0;

          if (half === 'left') {
            // Левая половина поля
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * (BOARD_SIZE / 2));
          } else {
            // Правая половина поля
            row = Math.floor(Math.random() * BOARD_SIZE);
            col = Math.floor(Math.random() * (BOARD_SIZE / 2)) + (BOARD_SIZE / 2);
          }

          const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (canPlaceShip(row, col, shipType.size, orientation)) {
            placeShip(row, col, shipType.size, orientation);
            placed = true;
          }

          attempts++;
        }

        if (!placed) {
          placeShipRandomly(shipType.size);
        }
      }
    }
  }

  // Размещение одного корабля случайным образом (запасной вариант)
  function placeShipRandomly(size: number): void {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 1000) {
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

      if (canPlaceShip(row, col, size, orientation)) {
        placeShip(row, col, size, orientation);
        placed = true;
      }

      attempts++;
    }
  }

  // Очистка игрового поля
  function clearBoard(): void {
    gameState.playerBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    gameState.ships = [];
    gameState.placedShips = { 4: 0, 3: 0, 2: 0, 1: 0 };

    const startGameBtn = document.getElementById('startGameBtn') as HTMLButtonElement;
    if (startGameBtn) {
      startGameBtn.disabled = true;
    }

    renderBoard();
  }

  // Визуализация игрового поля
  function renderBoard(): void {
    const cells = document.querySelectorAll('.cell[data-row][data-col]');

    cells.forEach(cell => {
      const row = parseInt((cell as HTMLElement).dataset.row || '');
      const col = parseInt((cell as HTMLElement).dataset.col || '');

      cell.className = 'cell water';

      if (gameState.playerBoard[row][col] !== 0) {
        cell.classList.add('ship');
        cell.classList.remove('water');
      }
    });
  }

  // Инициализация интерфейса
  function initializeUI(): void {
    // Обработчики для выбора стратегии
    document.querySelectorAll('.strategy-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.strategy-option').forEach(opt => {
          opt.classList.remove('active');
        });
        option.classList.add('active');

        const strategy = (option as HTMLElement).dataset.strategy || 'manual';
        gameState.placementStrategy = strategy;

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

        gameState.selectedShipSize = parseInt((item as HTMLElement).dataset.size || '4');
      });
    });

    // Обработчики для выбора ориентации
    document.querySelectorAll('.orientation-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.orientation-btn').forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        gameState.orientation = (btn as HTMLElement).dataset.orientation as 'horizontal' | 'vertical';
      });
    });

    // Обработчики для кнопок
    const autoPlaceBtn = document.getElementById('autoPlaceBtn');
    if (autoPlaceBtn) {
      autoPlaceBtn.addEventListener('click', () => {
        autoPlaceShips(gameState.placementStrategy);
      });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clearBoard();
        updateShipCounters();
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

  // Запуск приложения
  document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    initializeUI();
  });

  */
}