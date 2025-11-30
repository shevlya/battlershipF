import { Injectable } from '@angular/core';
import { GameInvitationResponse } from './webSocket.service';

@Injectable({
  providedIn: 'root'
})
export class InvitationStoreService {
  private currentInvitation: GameInvitationResponse | null = null;

  setInvitation(inv: GameInvitationResponse) {
    this.currentInvitation = inv;
  }

  getInvitation(): GameInvitationResponse | null {
    return this.currentInvitation;
  }

  clear() {
    this.currentInvitation = null;
  }
}
