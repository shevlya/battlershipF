import { Injectable } from '@angular/core';
import SockJS from 'sockjs-client';
import * as Stomp from 'webstomp-client';
import { environment } from '../../environments/environment';

export interface GameInvitationRequest {
  inviterId: number;
  opponentId: number;
  inviterNickname: string;
  inviterAvatarUrl: string | null;
}

export interface GameInvitationResponse {
  gameId: number | null;
  inviterId: number;
  inviterNickname: string;
  inviterAvatarUrl: string | null;
  timestamp: string;
}

export interface GameStartNotification {
  gameId: number | null;
  opponentId: number | null;
  opponentNickname: string;
  opponentAvatarUrl: string | null;
  currentTurnPlayerId?: number | null;
}

export interface GameDecisionRequest {
  inviterId: number;
  opponentId: number;
}

export interface ShipPlacement {
  shipId: number;
  size: number;
  row: number;
  col: number;
  vertical: boolean;
}

export interface BoardLayoutDTO {
  ships: ShipPlacement[];
  matrix: string[][];  // Character[][] в Java эквивалентен string[][] в TypeScript
}

export interface GameReadyMessage {
  playerId: number;
  opponentId: number;
  boardLayout: BoardLayoutDTO;
  gameType: string;
}

export interface GameMoveDTO {
  gameId: number;
  playerId: number;
  row: number;
  column: number;
}

export interface GetGameStateRequest {
  gameId: number;
  playerId: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private stompClient: Stomp.Client | null = null;
  private currentPlayerId: number | null = null;

  connect(playerId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!playerId || playerId <= 0) {
        reject(new Error('Invalid player ID'));
        return;
      }

      try {
        console.log('WS: connecting to', `${environment.apiUrl}/ws`);
        const socket = new SockJS(`${environment.apiUrl}/ws`);
        this.stompClient = Stomp.over(socket, { debug: true });
        this.currentPlayerId = playerId; // ← сохраняем id игрока

        this.stompClient.connect(
          {},
          () => {
            console.log('WS: connected successfully for player', playerId);
            resolve();
          },
          (error: any) => {
            console.error('WS: connection failed:', error);
            this.stompClient = null;
            this.currentPlayerId = null;
            reject(error);
          }
        );
      } catch (e) {
        console.error('WS: setup error:', e);
        reject(e);
      }
    });
  }

  disconnect() {
    if (this.stompClient) {
      try {
        this.stompClient.disconnect();
      } catch (e) {
        console.warn('WS: disconnect error:', e);
      }
      this.stompClient = null;
    }
    this.currentPlayerId = null;
  }

  private ensureConnected(): boolean {
    if (!this.stompClient) {
      console.warn('WebSocket not connected. Skipping operation.');
      return false;
    }
    return true;
  }

  getCurrentPlayerId(): number | null {
    return this.currentPlayerId;
  }

  isConnected(): boolean {
    return !!this.stompClient && this.stompClient.connected;
  }

  // ============== ОТПРАВКА ==============
  sendInvitation(invitation: GameInvitationRequest) {
    try {
      if (!this.ensureConnected()) return;
      const payload = JSON.stringify(invitation);
      console.log('WS invitation payload:', payload);
      this.stompClient!.send(
        '/app/game.invite',
        payload,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to send invitation:', e);
    }
  }

  acceptInvitation(inviterId: number, opponentId: number) {
    try {
      if (!this.ensureConnected()) return;
      const payload: GameDecisionRequest = { inviterId, opponentId };
      const body = JSON.stringify(payload);
      this.stompClient!.send(
        '/app/game.accept',
        body,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to accept invitation:', e);
    }
  }

  rejectInvitation(inviterId: number, opponentId: number) {
    try {
      if (!this.ensureConnected()) return;
      const payload: GameDecisionRequest = { inviterId, opponentId };
      const body = JSON.stringify(payload);
      this.stompClient!.send(
        '/app/game.reject',
        body,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to reject invitation:', e);
    }
  }

  sendPlayerReady(message: GameReadyMessage) {
    try {
      if (!this.ensureConnected()) return;
      const payload = JSON.stringify(message);
      console.log('WS: sending player ready message', payload);
      this.stompClient!.send(
        '/app/game.ready',
        payload,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to send player ready message:', e);
    }
  }

  // Метод для отправки хода
  sendGameMove(move: GameMoveDTO) {
    try {
      if (!this.ensureConnected()) return;
      const payload = JSON.stringify(move);
      console.log('WS: sending game move:', payload);
      this.stompClient!.send(
        '/app/game.move',
        payload,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to send game move:', e);
    }
  }

  // Метод для запроса состояния игры
  sendGetGameState(request: GetGameStateRequest) {
    try {
      if (!this.ensureConnected()) return;
      const payload = JSON.stringify(request);
      console.log('WS: sending get game state request:', payload);
      this.stompClient!.send(
        '/app/game.state',
        payload,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to send get game state request:', e);
    }
  }

  // Метод для отправки игровых действий (сдача, ничья)
  sendGameAction(action: any) {
    try {
      if (!this.ensureConnected()) return;
      const payload = JSON.stringify(action);
      console.log('WS: sending game action:', payload);
      this.stompClient!.send(
        '/app/game.action',
        payload,
        { 'content-type': 'application/json' }
      );
    } catch (e) {
      console.error('Failed to send game action:', e);
    }
  }

  // ============== ПОДПИСКИ ==============
  subscribeToInvitations(callback: (inv: GameInvitationResponse) => void) {
    try {
      if (!this.ensureConnected()) return;
      if (!this.currentPlayerId) {
        console.warn('currentPlayerId is null, cannot subscribe to invitations');
        return;
      }
      const destination = `/queue/invitations/${this.currentPlayerId}`;
      console.log('WS: subscribe to invitations:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body: GameInvitationResponse = JSON.parse(message.body);
          console.log('WS: invitation received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing invitation message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to invitations:', e);
      return null;
    }
  }

  subscribeToGameStart(callback: (game: GameStartNotification) => void) {
    try {
      if (!this.ensureConnected()) return;
      if (!this.currentPlayerId) {
        console.warn('currentPlayerId is null, cannot subscribe to game.start');
        return;
      }
      const destination = `/queue/game.start/${this.currentPlayerId}`;
      console.log('WS: subscribe to game.start:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body: GameStartNotification = JSON.parse(message.body);
          console.log('WS: game.start received:', body);
          callback(body);

          // Если пришло уведомление о начале игры с gameId - запрашиваем состояние
          if (body.gameId && body.gameId > 0) {
            console.log('Получен gameId из game.start, запрашиваем состояние игры');
            this.sendGetGameState({
              gameId: body.gameId,
              playerId: this.currentPlayerId!
            });
          }
        } catch (e) {
          console.error('Error parsing game start message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to game start:', e);
      return null;
    }
  }

  subscribeToGameStartDirect(callback: (notification: GameStartNotification) => void) {
    try {
      if (!this.ensureConnected() || !this.currentPlayerId) {
        console.warn('WebSocket не подключен или нет currentPlayerId');
        return null;
      }
      const destination = `/queue/game.start/${this.currentPlayerId}`;
      console.log('WS: subscribe to game.start direct:', destination);
      return this.stompClient!.subscribe(
        destination,
        (message: Stomp.Message) => {
          try {
            const body: GameStartNotification = JSON.parse(message.body);
            console.log('WS: game.start direct received:', body);
            callback(body);

            // Если пришло уведомление о начале игры с gameId - запрашиваем состояние
            if (body.gameId && body.gameId > 0) {
              console.log('Получен gameId из game.start direct, запрашиваем состояние игры');
              this.sendGetGameState({
                gameId: body.gameId,
                playerId: this.currentPlayerId!
              });
            }
          } catch (e) {
            console.error('Error parsing game start direct message:', e);
          }
        }
      );
    } catch (e) {
      console.error('Failed to subscribe to game start direct:', e);
      return null;
    }
  }

  subscribeToRejection(callback: (game: GameStartNotification) => void) {
    try {
      if (!this.ensureConnected()) return;
      if (!this.currentPlayerId) {
        console.warn('currentPlayerId is null, cannot subscribe to game.rejected');
        return;
      }
      const destination = `/queue/game.rejected/${this.currentPlayerId}`;
      console.log('WS: subscribe to game.rejected:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body: GameStartNotification = JSON.parse(message.body);
          console.log('WS: game.rejected received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing rejection message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to rejection:', e);
      return null;
    }
  }

  // Добавить новый метод для подписки на состояние игры
  subscribeToGameState(playerId: number, callback: (gameState: any) => void): any {
    try {
      if (!this.ensureConnected() || !playerId) {
        console.warn('WebSocket не подключен или нет playerId');
        return null;
      }
      const destination = `/queue/game.state/${playerId}`;
      console.log('WS: subscribe to game.state:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body = JSON.parse(message.body);
          console.log('WS: game.state received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing game state message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to game state:', e);
      return null;
    }
  }

  // Метод для подписки на завершение игры
  subscribeToGameEnd(playerId: number, callback: (notification: any) => void): any {
    try {
      if (!this.ensureConnected() || !playerId) {
        console.warn('WebSocket не подключен или нет playerId');
        return null;
      }
      const destination = `/queue/game.end/${playerId}`;
      console.log('WS: subscribe to game.end:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body = JSON.parse(message.body);
          console.log('WS: game.end received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing game end message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to game end:', e);
      return null;
    }
  }

  // Метод для подписки на ошибки
  subscribeToErrors(playerId: number, callback: (error: any) => void): any {
    try {
      if (!this.ensureConnected() || !playerId) {
        console.warn('WebSocket не подключен или нет playerId');
        return null;
      }
      const destination = `/queue/game.error/${playerId}`;
      console.log('WS: subscribe to game.error:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body = JSON.parse(message.body);
          console.log('WS: game.error received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing error message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to errors:', e);
      return null;
    }
  }

  // Метод для подписки на предложения ничьи
  subscribeToDrawOffers(playerId: number, callback: (offer: any) => void): any {
    try {
      if (!this.ensureConnected() || !playerId) {
        console.warn('WebSocket не подключен или нет playerId');
        return null;
      }
      const destination = `/queue/game.draw/${playerId}`;
      console.log('WS: subscribe to game.draw:', destination);
      return this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body = JSON.parse(message.body);
          console.log('WS: game.draw received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing draw offer message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to draw offers:', e);
      return null;
    }
  }
}
