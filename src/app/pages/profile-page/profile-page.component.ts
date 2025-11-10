import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent {
  user = {
    username: 'dollPlayer',
    avatar: '', // Будет подтягиваться из БД
    totalGames: 25,
    wins: 15,
    losses: 10,
    savedLayouts: 5
  };

  constructor(private router: Router) {}

  getInitials(): string {
    if (!this.user.username || this.user.username.length === 0) {
      return 'U'; // Заглушка если username пустой
    }
    return this.user.username.charAt(0).toUpperCase();
  }

  changeAvatar() {
    this.router.navigate(['/change-avatar']);
  }

  changePassword() {
    this.router.navigate(['/change-password']);
  }
}