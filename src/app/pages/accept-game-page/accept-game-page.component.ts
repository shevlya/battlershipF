import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Player {
  id: number;
  username: string;
  avatar: string;
  rating?: number;
  gamesPlayed?: number;
}

interface Invitation {
  id: number;
  inviter: Player;
  timestamp: string;
  expiresIn: number;
}

@Component({
  selector: 'app-accept-game',
  standalone: true,
  imports: [RouterModule, CommonModule, HttpClientModule],
  templateUrl: './accept-game-page.component.html',
  styleUrl: './accept-game-page.component.scss'
})
export class AcceptGameComponent implements OnInit, OnDestroy {  
  invitation: Invitation | null = null;
  isLoading = true;
  errorMessage = '';
  timeLeft = 60; // 60 секунд на принятие решения
  private timer: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadInvitation();
    this.startTimer();
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  loadInvitation() {
    // Получаем ID приглашения из параметров URL
    const inviteId = this.route.snapshot.paramMap.get('id');
    
    if (!inviteId) {
      this.errorMessage = 'Приглашение не найдено';
      this.isLoading = false;
      return;
    }

    // TODO: Заменить на реальный эндпоинт вашего API
    this.http.get<Invitation>(`/api/invitations/${inviteId}`).subscribe({
      next: (invitation) => {
        this.invitation = invitation;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки приглашения:', error);
        this.errorMessage = 'Не удалось загрузить приглашение';
        this.isLoading = false;
      }
    });
  }

  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.rejectInvite(); // Автоматическое отклонение при истечении времени
      }
    }, 1000);
  }

  acceptInvite() {
    if (!this.invitation) return;

    // TODO: Заменить на реальный эндпоинт
    this.http.post(`/api/invitations/${this.invitation.id}/accept`, {}).subscribe({
      next: () => {
        console.log('Приглашение принято');
        // Переход на страницу расстановки кораблей или игры
        this.router.navigate(['/game-setup'], { 
          queryParams: { opponentId: this.invitation?.inviter.id } 
        });
      },
      error: (error) => {
        console.error('Ошибка принятия приглашения:', error);
        alert('Не удалось принять приглашение');
      }
    });
  }

  rejectInvite() {
    if (!this.invitation) {
      this.router.navigate(['/lobby']);
      return;
    }

    // TODO: Заменить на реальный эндпоинт
    this.http.post(`/api/invitations/${this.invitation.id}/reject`, {}).subscribe({
      next: () => {
        console.log('Приглашение отклонено');
        this.router.navigate(['/lobby']);
      },
      error: (error) => {
        console.error('Ошибка отклонения приглашения:', error);
        this.router.navigate(['/lobby']);
      }
    });
  }

  // Добавьте этот метод для навигации из шаблона
  navigateToLobby() {
    this.router.navigate(['/lobby']);
  }

  // Устанавливаем изображение-заглушку при ошибке загрузки аватара
  handleImageError(event: any) {
    event.target.src = '/assets/avatars/defavatar.jpg';
  }
}