import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import { GameService } from '../../services/game.service';
import { GameResponse, GameState } from '../../services/models/game.model';
import { finalize } from 'rxjs/operators';
import {ComputerStrategy} from "../../services/models/computer.model";
import {CommonModule, NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-single-player-game-page',
  templateUrl: './single-player-game-page.component.html',
  standalone: true,
  styleUrls: ['./single-player-game-page.component.scss'],
  imports: [
    CommonModule,
    NgForOf,
    NgIf
  ]
})
export class SinglePlayerGamePageComponent implements OnInit {
  gameId!: number;
  gameState: GameState = {
    status: 'WAITING',
    currentPlayer: 'HUMAN',
    humanBoard: this.createEmptyBoard(),
    computerBoard: this.createEmptyBoard(),
    shipsPlaced: false,
    gameOver: false,
    winner: null
  };

  // Для отображения координат
  rows = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // Состояние игры
  isYourTurn = true;
  myShipsCount = 10;
  opponentShipsCount = 10;
  myShotsCount = 0;
  myHitsCount = 0;

  // Попапы
  showSurrenderPopup = false;
  showGameOverPopup = false;
  gameOverMessage = '';

  loading = false;
  error = '';

  // Доски для отображения
  myField: string[][] = this.createEmptyBoard();
  myHits: string[][] = this.createEmptyBoard(); // 'H' для попаданий, 'M' для промахов
  opponentField: string[][] = this.createEmptyBoard(); // 'H' для попаданий, 'M' для промахов

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private gameService: GameService
  ) { }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.gameId = +params['id'];
        this.loadGameState();
      } else {
        this.startNewGame();
      }
    });
  }

  startNewGame(): void {
    this.loading = true;
    this.error = '';

    // Получаем выбранную стратегию компьютера из localStorage или используем по умолчанию
    const selectedStrategy = localStorage.getItem('selectedComputerStrategy') || 'coastal';

    this.gameService.createSinglePlayerGame(<ComputerStrategy>selectedStrategy).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (game: GameResponse) => {
        this.gameId = game.id;
        this.updateGameState(game.state);
        this.router.navigate(['/game/computer', this.gameId]);
      },
      error: (err) => {
        this.error = 'Не удалось создать новую игру. Попробуйте еще раз.';
        console.error('Error creating game:', err);
      }
    });
  }

  loadGameState(): void {
    this.loading = true;
    this.error = '';

    this.gameService.getSinglePlayerGameState(this.gameId).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (gameState: GameState) => {
        this.updateGameState(gameState);
      },
      error: (err) => {
        this.error = 'Не удалось загрузить состояние игры.';
        console.error('Error loading game state:', err);
      }
    });
  }

  updateGameState(gameState: GameState): void {
    this.gameState = gameState;

    // Обновляем отображение досок
    this.updateBoards();

    // Обновляем состояние хода
    this.isYourTurn = gameState.currentPlayer === 'HUMAN';

    // Если игра завершена, показываем попап
    if (gameState.gameOver && gameState.winner) {
      this.showGameOverPopup = true;
      this.gameOverMessage = gameState.winner === 'HUMAN'
        ? 'Поздравляем! Вы победили компьютер!'
        : 'Компьютер победил. Попробуйте еще раз!';
    }

    // Обновляем счетчики
    this.updateShipCounts();
    this.updateShotStats();
  }

  updateBoards(): void {
    // Доска игрока (мои корабли и выстрелы компьютера)
    const humanBoard = this.gameState.humanBoard;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        this.myField[i][j] = humanBoard[i][j] || ' ';
        // Отмечаем попадания компьютера
        if (humanBoard[i][j] === 'X') {
          this.myHits[i][j] = 'H';
        } else if (humanBoard[i][j] === 'O') {
          this.myHits[i][j] = 'M';
        }
      }
    }

    // Доска компьютера (только мои выстрелы)
    const computerBoard = this.gameState.computerBoard;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        // Показываем только результаты наших выстрелов
        if (computerBoard[i][j] === 'X') {
          this.opponentField[i][j] = 'H'; // Попадание
        } else if (computerBoard[i][j] === 'O') {
          this.opponentField[i][j] = 'M'; // Промах
        } else {
          this.opponentField[i][j] = ' '; // Пусто (корабли скрыты)
        }
      }
    }
  }

  updateShipCounts(): void {
    // Подсчет оставшихся кораблей игрока
    this.myShipsCount = 0;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (this.myField[i][j] === 'S' && this.myHits[i][j] !== 'H') {
          this.myShipsCount++;
        }
      }
    }

    // Подсчет оставшихся кораблей компьютера
    this.opponentShipsCount = 0;
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        // Считаем по исходной доске компьютера (где 'S' - корабли)
        if (this.gameState.computerBoard[i][j] === 'S' && this.opponentField[i][j] !== 'H') {
          this.opponentShipsCount++;
        }
      }
    }
  }

  updateShotStats(): void {
    this.myShotsCount = 0;
    this.myHitsCount = 0;

    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (this.opponentField[i][j] === 'H' || this.opponentField[i][j] === 'M') {
          this.myShotsCount++;
        }
        if (this.opponentField[i][j] === 'H') {
          this.myHitsCount++;
        }
      }
    }
  }

  isShipSunk(row: number, col: number, isMyField: boolean): boolean {
    // Упрощенная логика для примера
    return false;
  }

  onOpponentCellClick(row: number, col: number): void {
    if (!this.isYourTurn || this.gameState.gameOver) {
      return;
    }

    if (this.opponentField[row][col] !== ' ') {
      return; // Уже стреляли в эту клетку
    }

    this.loading = true;
    this.error = '';

    this.gameService.makePlayerMove(this.gameId, row, col).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (updatedGame: GameResponse) => {
        this.updateGameState(updatedGame.state);
      },
      error: (err) => {
        this.error = 'Ошибка при совершении хода. Попробуйте еще раз.';
        console.error('Error making move:', err);
      }
    });
  }

  surrender(): void {
    this.showSurrenderPopup = true;
  }

  confirmSurrender(): void {
    this.loading = true;
    this.error = '';

    this.gameService.surrenderGame(this.gameId).pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (updatedGame: GameResponse) => {
        this.updateGameState(updatedGame.state);
        this.showSurrenderPopup = false;
      },
      error: (err) => {
        this.error = 'Ошибка при сдаче. Попробуйте еще раз.';
        console.error('Error surrendering:', err);
        this.loading = false;
      }
    });
  }

  cancelSurrender(): void {
    this.showSurrenderPopup = false;
  }

  // Вспомогательные методы
  createEmptyBoard(): string[][] {
    return Array(10).fill(0).map(() => Array(10).fill(' '));
  }
}
