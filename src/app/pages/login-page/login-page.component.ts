import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  username = '';
  password = '';
  loginError = false; // Для отображения ошибки

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    if (!this.username || !this.password) {
      console.error('Логин и пароль обязательны');
      return;
    }

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        // Сохраняем токен и данные пользователя
        this.authService.setTokenAndUser(response.token, response);
        console.log('Успешная авторизация:', response);
        this.loginError = false;
        // Перенаправляем в лобби
        this.router.navigate(['/lobby']);
      },
      error: (err) => {
        console.error('Ошибка авторизации:', err);
        this.loginError = true;
        // Можно показать сообщение об ошибке пользователю
      }
    });
  }
}
