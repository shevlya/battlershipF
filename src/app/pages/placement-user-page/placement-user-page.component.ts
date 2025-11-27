import { Component } from '@angular/core';

interface Ship {
  type: string;
  size: number;
  positions: { row: string; col: number }[];
  placed: boolean;
  id: number;
}

@Component({
  selector: 'app-placement-user-page',
  standalone: true,
  imports: [],
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
        
        // Вычисляем потенциальные позиции для подсветки
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

  onDrop(event: DragEvent) {
    event.preventDefault();
    
    if (!this.draggedShip || !this.hoveredCell) return;
    
    const { row, col } = this.hoveredCell;
    
    // Проверяем, можно ли разместить корабль
    if (this.canPlaceShip(this.draggedShip, row, col)) {
      this.placeShip(this.draggedShip, row, col);
    }
    
    this.draggedShip = null;
    this.hoveredCell = null;
    this.potentialPositions = [];
  }

  canPlaceShip(ship: any, startRow: string, startCol: number): boolean {
    const positions = this.getShipPositions(ship.size, startRow, startCol);
    
    // Проверяем, что корабль не выходит за границы поля
    for (const pos of positions) {
      if (!this.isValidPosition(pos.row, pos.col)) {
        return false;
      }
    }
    
    // Проверяем, что клетки не заняты другими кораблями
    for (const pos of positions) {
      if (this.hasShip(pos.row, pos.col)) {
        return false;
      }
      
      // Проверяем соседние клетки (корабли не должны касаться друг друга)
      if (this.hasAdjacentShip(pos.row, pos.col)) {
        return false;
      }
    }
    
    return true;
  }

  getShipPositions(size: number, startRow: string, startCol: number): { row: string, col: number }[] {
    const positions = [];
    const startRowIndex = this.rows.indexOf(startRow);
    
    if (this.isHorizontal) {
      // Автоматическое определение направления для горизонтального корабля
      const shouldFlip = this.shouldFlipHorizontal(startCol, size);
      
      if (shouldFlip) {
        // Хвост слева (корабль растет вправо)
        for (let i = 0; i < size; i++) {
          positions.push({
            row: startRow,
            col: startCol + i
          });
        }
      } else {
        // Хвост справа (корабль растет влево)
        for (let i = 0; i < size; i++) {
          positions.push({
            row: startRow,
            col: startCol - i
          });
        }
      }
    } else {
      // Автоматическое определение направления для вертикального корабля
      const shouldFlip = this.shouldFlipVertical(startRowIndex, size);
      
      if (shouldFlip) {
        // Хвост сверху (корабль растет вниз)
        for (let i = 0; i < size; i++) {
          if (startRowIndex + i < this.rows.length) {
            positions.push({
              row: this.rows[startRowIndex + i],
              col: startCol
            });
          }
        }
      } else {
        // Хвост снизу (корабль растет вверх)
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

  // Определяет, нужно ли перевернуть горизонтальный корабль
  shouldFlipHorizontal(startCol: number, size: number): boolean {
    // Если корабль близко к левой границе - хвост справа
    if (startCol <= size) {
      return true;
    }
    // Если корабль близко к правой границе - хвост слева
    if (startCol >= this.columns.length - size + 1) {
      return false;
    }
    // По умолчанию - хвост слева (растет вправо)
    return true;
  }

  // Определяет, нужно ли перевернуть вертикальный корабль
  shouldFlipVertical(startRowIndex: number, size: number): boolean {
    // Если корабль близко к верхней границе - хвост снизу
    if (startRowIndex < size) {
      return true;
    }
    // Если корабль близко к нижней границе - хвост сверху
    if (startRowIndex >= this.rows.length - size) {
      return false;
    }
    // По умолчанию - хвост сверху (растет вниз)
    return true;
  }

  placeShip(ship: any, startRow: string, startCol: number) {
    const positions = this.getShipPositions(ship.size, startRow, startCol);
    
    // Находим первый неразмещенный корабль данного типа
    const availableShip = this.ships.find(s => 
      s.type === ship.type && !s.placed
    );
    
    if (availableShip) {
      availableShip.positions = positions;
      availableShip.placed = true;
    }
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
      { r: -1, c: 0 },  // вверх
      { r: 1, c: 0 },   // вниз
      { r: 0, c: -1 },  // влево
      { r: 0, c: 1 },   // вправо
      { r: -1, c: -1 }, // вверх-влево
      { r: -1, c: 1 },  // вверх-вправо
      { r: 1, c: -1 },  // вниз-влево
      { r: 1, c: 1 }    // вниз-вправо
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

  isValidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;
    
    // Проверяем, находится ли ячейка в потенциальных позициях и можно ли разместить корабль
    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
           this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  isInvalidDropZone(row: string, col: number): boolean {
    if (!this.draggedShip || !this.hoveredCell) return false;
    
    // Проверяем, находится ли ячейка в потенциальных позициях и нельзя ли разместить корабль
    return this.potentialPositions.some(pos => pos.row === row && pos.col === col) &&
           !this.canPlaceShip(this.draggedShip, this.hoveredCell.row, this.hoveredCell.col);
  }

  toggleOrientation() {
    this.isHorizontal = !this.isHorizontal;
    console.log(`Ориентация изменена на: ${this.isHorizontal ? 'горизонтальная' : 'вертикальная'}`);
  }

  getRemainingShipsCount(type: string): number {
    return this.ships.filter(ship => ship.type === type && !ship.placed).length;
  }

  isAllShipsPlaced(): boolean {
    return this.ships.every(ship => ship.placed);
  }

  // Новая функция для очистки поля
  clearBoard() {
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
    console.log('Поле очищено');
  }

  savePlacement() {
    console.log('Сохранение расстановки', this.ships);
  }

  generateRandom() {
    // Сбрасываем все корабли
    this.ships.forEach(ship => {
      ship.positions = [];
      ship.placed = false;
    });
    
    // Размещаем корабли случайным образом
    const shipTypes = [...this.ships];
    
    for (const ship of shipTypes) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const randomRow = this.rows[Math.floor(Math.random() * this.rows.length)];
        const randomCol = this.columns[Math.floor(Math.random() * this.columns.length)];
        const randomOrientation = Math.random() > 0.5;
        
        // Временно меняем ориентацию для проверки
        const currentOrientation = this.isHorizontal;
        this.isHorizontal = randomOrientation;
        
        if (this.canPlaceShip(ship, randomRow, randomCol)) {
          this.placeShip(ship, randomRow, randomCol);
          placed = true;
        }
        
        this.isHorizontal = currentOrientation;
        attempts++;
      }
    }
    
    console.log('Генерация случайной расстановки');
  }

  loadPlacement() {
    console.log('Загрузка расстановки');
  }

  startGame() {
    if (this.isAllShipsPlaced()) {
      console.log('Начало игры');
    } else {
      alert('Разместите все корабли перед началом игры!');
    }
  }
}