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
  loginError = false;
  fieldsEmpty = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Очистка ошибок при вводе в поле логина
  onUsernameInput() {
    this.loginError = false;
    this.fieldsEmpty = false;
  }

  // Очистка ошибок при вводе в поле пароля
  onPasswordInput() {
    this.loginError = false;
    this.fieldsEmpty = false;
  }

  onSubmit() {
    // Сброс ошибок
    this.loginError = false;
    this.fieldsEmpty = false;

    // Проверка на пустые поля
    if (!this.username.trim() || !this.password) {
      this.fieldsEmpty = true;
      console.error('Все поля обязательны');
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
      }
    });
  }
}