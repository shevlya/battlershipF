// src/app/services/webSocket.service.ts
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
interface ShipPlacement {
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
  // ============== ПОДПИСКИ ==============
// метод для подписки на начало игры
  subscribeToGameStartDirect(callback: (notification: GameStartNotification) => void) {
    try {
      if (!this.ensureConnected() || !this.currentPlayerId) {
        console.warn('WebSocket не подключен или нет currentPlayerId. Повторная попытка через 2с...');
        setTimeout(() => this.subscribeToGameStartDirect(callback), 2000);
        return;
      }

      const destination = `/queue/game.start${this.currentPlayerId}`;
      console.log('WS: subscribe to game.start direct:', destination);

      this.stompClient!.subscribe(
        destination,
        (message: Stomp.Message) => {
          try {
            const body: GameStartNotification = JSON.parse(message.body);
            console.log('WS: game.start direct received:', body);
            callback(body);
          } catch (e) {
            console.error('Error parsing game start direct message:', e);
          }
        }
      );
    } catch (e) {
      console.error('Failed to subscribe to game start direct:', e);
    }
  }

  subscribeToInvitations(callback: (inv: GameInvitationResponse) => void) {
    try {
      if (!this.ensureConnected()) return;
      if (!this.currentPlayerId) {
        console.warn('currentPlayerId is null, cannot subscribe to invitations');
        return;
      }

      const destination = `/queue/invitations/${this.currentPlayerId}`;
      console.log('WS: subscribe to invitations:', destination);

      this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
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

      this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
        try {
          const body: GameStartNotification = JSON.parse(message.body);
          console.log('WS: game.start received:', body);
          callback(body);
        } catch (e) {
          console.error('Error parsing game start message:', e);
        }
      });
    } catch (e) {
      console.error('Failed to subscribe to game start:', e);
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

      this.stompClient!.subscribe(destination, (message: Stomp.Message) => {
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
    }
  }

  isConnected(): boolean {
    return !!this.stompClient;
  }
}
