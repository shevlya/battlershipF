// src/app/pages/accept-game-page/accept-game-page.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  GameInvitationResponse,
  WebSocketService
} from '../../services/webSocket.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-accept-game',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './accept-game-page.component.html',
  styleUrl: './accept-game-page.component.scss'
})
export class AcceptGameComponent implements OnInit, OnDestroy {
  invitation: GameInvitationResponse | null = null;
  isLoading = true;
  errorMessage = '';
  timeLeft = 60;
  private timer: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ws: WebSocketService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const state = history.state as GameInvitationResponse | undefined;
    console.log('AcceptGameComponent history.state:', state);

    if (state && state.inviterId) {
      this.invitation = state;
      this.isLoading = false;
      this.startTimer();
    } else {
      this.errorMessage = 'Приглашение не найдено';
      this.isLoading = false;
    }
  }


  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;

      if (this.timeLeft <= 0) {
        this.rejectInvite();
      }
    }, 1000);
  }

  acceptInvite() {
    if (!this.invitation) return;

    const currentUser = this.authService.getCurrentUser();
    const opponentId = Number(
      currentUser?.player_id
    );
    const inviterId = this.invitation.inviterId;

    if (!opponentId || !inviterId) {
      console.error('Не хватает данных для acceptInvite');
      return;
    }

    this.ws.acceptInvitation(inviterId, opponentId);

    // сам принимающий тоже идёт на расстановку
    this.router.navigate(['/placement'], {
      queryParams: {
        opponentId: inviterId,
        opponentNickname: this.invitation.inviterNickname
      }
    });
  }
  getAvatarPath(avatarUrl: string | null): string {
    if (!avatarUrl) {
      return '/assets/avatars/defavatar.jpg'; // запасной вариант
    }
    return `/assets/avatars/${avatarUrl}`;
  }
  rejectInvite() {
    if (!this.invitation) {
      this.router.navigate(['/lobby']);
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    const opponentId = Number(
      currentUser?.player_id
    );
    const inviterId = this.invitation.inviterId;

    if (!opponentId || !inviterId) {
      console.error('Не хватает данных для rejectInvite');
      this.router.navigate(['/lobby']);
      return;
    }

    this.ws.rejectInvitation(inviterId, opponentId);
    this.router.navigate(['/lobby']);
  }

  navigateToLobby() {
    this.router.navigate(['/lobby']);
  }

  handleImageError(event: any) {
    event.target.src = '/assets/avatars/defavatar.jpg';
  }
}
