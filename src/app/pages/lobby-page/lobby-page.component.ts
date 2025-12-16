// src/app/pages/lobby-page/lobby-page.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  WebSocketService,
  GameInvitationResponse,
  GameStartNotification
} from '../../services/webSocket.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.scss'
})
export class LobbyPageComponent implements OnInit, OnDestroy {
  private subscriptionsInitialized = false;
  currentPlayer: any = null;
  gameMode: 'SINGLE_PLAYER' | 'MULTIPLAYER' | null = null;
  selectedDifficulty: string = 'captain';

  // Уровни сложности для одиночной игры
  difficulties = [
    { id: 'easy', name: 'Легкий', description: 'Для новичков' },
    { id: 'medium', name: 'Средний', description: 'Для опытных игроков' },
    { id: 'captain', name: 'Капитан', description: 'Для настоящих морских волков' }
  ];

  constructor(
    private router: Router,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadCurrentPlayer();
  }

  ngOnDestroy() {
    // Отключаем WebSocket только если мы в режиме одиночной игры
    if (this.gameMode === 'SINGLE_PLAYER' && this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }
  }

  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь в лобби:', this.currentPlayer);
  }

  /**
   * Выбор режима игры
   */
  selectGameMode(mode: 'SINGLE_PLAYER' | 'MULTIPLAYER') {
    this.gameMode = mode;
    console.log('Выбран режим игры:', mode);

    if (mode === 'MULTIPLAYER') {
      // Для мультиплеера подключаем WebSocket
      this.connectToWebSocket();
    } else {
      // Для одиночной игры отключаем WebSocket, если был подключен
      if (this.webSocketService.isConnected()) {
        this.webSocketService.disconnect();
      }
    }
  }

  /**
   * Начать одиночную игру
   */
  // В методе для одиночной игры:
  startSinglePlayerGame(difficulty: string) {
    if (!this.currentPlayer?.player_id) {
      console.error('Пользователь не авторизован');
      return;
    }

    console.log(`Начинаем одиночную игру с уровнем сложности: ${difficulty}`);

    // Очищаем WebSocket для одиночной игры
    if (this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }

    // Переходим на страницу расстановки с явным указанием режима
    this.router.navigate(['/placement'], {
      queryParams: {
        gameType: 'SINGLE_PLAYER',
        difficulty: difficulty,
        playerId: this.currentPlayer.player_id
      }
    });
  }

// В методе для мультиплеера:
  startMultiplayerGame(opponentId: number) {
    const playerId = this.currentPlayer?.player_id;
    if (!playerId) {
      console.error('Пользователь не авторизован');
      return;
    }

    console.log(`Начинаем мультиплеерную игру с оппонентом: ${opponentId}`);

    // Убеждаемся, что WebSocket подключен
    if (!this.webSocketService.isConnected()) {
      console.log('Подключаем WebSocket для мультиплеера...');
      this.connectToWebSocket().then(() => {
        // После подключения переходим на страницу расстановки
        this.router.navigate(['/placement'], {
          queryParams: {
            gameType: 'MULTIPLAYER',
            opponentId: opponentId,
            playerId: playerId
          }
        });
      });
    } else {
      // WebSocket уже подключен
      this.router.navigate(['/placement'], {
        queryParams: {
          gameType: 'MULTIPLAYER',
          opponentId: opponentId,
          playerId: playerId
        }
      });
    }
  }

  /**
   * Подключение к WebSocket для мультиплеера
   */
  private async connectToWebSocket() {
    const playerId = this.currentPlayer ? Number(this.currentPlayer.player_id) : NaN;

    if (!playerId) {
      console.warn('Игрок не найден, WebSocket не подключаем');
      return;
    }

    if (!this.webSocketService.isConnected()) {
      console.log('Подключение к WebSocket для мультиплеера...');
      this.webSocketService
        .connect(playerId)
        .then(() => {
          console.log('WS подключен для мультиплеера');
          this.initWebSocketSubscriptions();
        })
        .catch(err => {
          console.error('Не удалось подключиться к WS в лобби:', err);
        });
    } else {
      console.log('WS уже подключён, инициализируем подписки для мультиплеера');
      this.initWebSocketSubscriptions();
    }
  }

  /**
   * Инициализация подписок WebSocket для мультиплеера
   */
  private initWebSocketSubscriptions() {
    if (this.subscriptionsInitialized) {
      console.log('Подписки в лобби уже инициализированы, пропускаем');
      return;
    }
    this.subscriptionsInitialized = true;

    // Приглашения
    this.webSocketService.subscribeToInvitations((inv: GameInvitationResponse) => {
      console.log('Пришло приглашение в лобби:', inv);

      // Переходим на страницу принятия приглашения
      this.router.navigate(['/accept-game'], {
        state: inv
      });
    });

    // Старт игры (когда оба игрока готовы)
    this.webSocketService.subscribeToGameStart((game: GameStartNotification) => {
      console.log('Игра начинается (лобби):', game);

      // Переходим на страницу расстановки для мультиплеера
      this.router.navigate(['/placement'], {
        queryParams: {
          opponentId: game.opponentId,
          opponentNickname: game.opponentNickname,
          gameType: 'MULTIPLAYER'
        }
      });
    });

    // Отклонение приглашения
    this.webSocketService.subscribeToRejection((game: GameStartNotification) => {
      console.log('Приглашение отклонено (лобби):', game);

      // Возвращаемся в лобби с флагом отклонения
      this.router.navigate(['/lobby'], {
        queryParams: { inviteRejected: 'true' }
      });
    });
  }

  /**
   * Найти случайного соперника
   */
  findRandomOpponent() {
    if (this.gameMode !== 'MULTIPLAYER') {
      console.error('Неверный режим игры для поиска соперника');
      return;
    }

    if (!this.webSocketService.isConnected()) {
      console.error('WebSocket не подключен');
      this.connectToWebSocket().then(() => {
        this.findRandomOpponent();
      });
      return;
    }

    console.log('Поиск случайного соперника...');

    // TODO: Реализовать поиск случайного соперника через WebSocket
    // Временно используем тестового соперника
    this.startTestMultiplayerGame();
  }

  /**
   * Начать тестовую мультиплеерную игру (для разработки)
   */
  private startTestMultiplayerGame() {
    const testOpponentId = 5; // Тестовый ID соперника
    const playerId = this.currentPlayer ? Number(this.currentPlayer.player_id) : 0;

    console.log('Начинаем тестовую мультиплеерную игру с соперником:', testOpponentId);

    this.router.navigate(['/placement'], {
      queryParams: {
        opponentId: testOpponentId,
        playerId: playerId,
        gameType: 'MULTIPLAYER'
      }
    });
  }

  /**
   * Изменить уровень сложности
   */
  changeDifficulty(difficulty: string) {
    this.selectedDifficulty = difficulty;
    console.log('Выбран уровень сложности:', difficulty);
  }

  /**
   * Вернуться к выбору режима игры
   */
  backToModeSelection() {
    this.gameMode = null;

    // Отключаем WebSocket если был подключен
    if (this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }

    this.subscriptionsInitialized = false;
  }

  /**
   * Выйти из аккаунта
   */
  logout() {
    // Отключаем WebSocket перед выходом
    if (this.webSocketService.isConnected()) {
      this.webSocketService.disconnect();
    }

    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
