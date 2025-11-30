// src/app/pages/lobby-page/lobby-page.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import {
  WebSocketService,
  GameInvitationResponse,
  GameStartNotification
} from '../../services/webSocket.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-lobby-page',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './lobby-page.component.html',
  styleUrl: './lobby-page.component.scss'
})
export class LobbyPageComponent implements OnInit {
  private subscriptionsInitialized = false;

  constructor(
    private router: Router,
    private webSocketService: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    console.log('Текущий пользователь в лобби:', user);

    const playerId = user ? Number(user.player_id ) : NaN;
    console.log('playerId в лобби:', playerId);

    if (!playerId) {
      console.warn('Игрок не найден, WebSocket не подключаем');
      return;
    }

    if (!this.webSocketService.isConnected()) {
      console.log('WS ещё не подключён, подключаем в лобби…');
      this.webSocketService
        .connect(playerId)
        .then(() => {
          console.log('WS подключен в LobbyPageComponent');
          this.initWebSocketSubscriptions();
        })
        .catch(err => {
          console.error('Не удалось подключиться к WS в лобби:', err);
        });
    } else {
      console.log('WS уже подключён, инициализируем подписки в лобби');
      this.initWebSocketSubscriptions();
    }
  }

  private initWebSocketSubscriptions() {
    if (this.subscriptionsInitialized) {
      console.log('Подписки в лобби уже инициализированы, пропускаем');
      return;
    }
    this.subscriptionsInitialized = true;

    // Приглашения
    this.webSocketService.subscribeToInvitations((inv: GameInvitationResponse) => {
      console.log('Пришло приглашение в лобби:', inv);

      this.router.navigate(['/accept-game'], {
        state: inv
      });
    });

    // Старт игры
    this.webSocketService.subscribeToGameStart((game: GameStartNotification) => {
      console.log('Игра начинается (лобби):', game);

      this.router.navigate(['/placement'], {
        queryParams: {
          opponentId: game.opponentId,
          opponentNickname: game.opponentNickname
        }
      });
    });

    // Отклонение приглашения
    this.webSocketService.subscribeToRejection((game: GameStartNotification) => {
      console.log('Приглашение отклонено (лобби):', game);

      this.router.navigate(['/lobby'], {
        queryParams: { inviteRejected: 'true' }
      });
    });
  }
}
