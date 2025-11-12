import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  username = '';
  password = '';
  confirmPassword = '';
  registerError = false;
  passwordMismatch = false;
  passwordTooShort = false; // Новое поле

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    // Сброс ошибок
    this.registerError = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;

    // Валидация
    if (!this.username || !this.password || !this.confirmPassword) {
      console.error('Все поля обязательны');
      return;
    }

    if (this.password.length < 6) {
      this.passwordTooShort = true; // Устанавливаем флаг
      console.error('Пароль должен быть не менее 6 символов');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.passwordMismatch = true;
      console.error('Пароли не совпадают');
      return;
    }

    // Вызов сервиса регистрации
    this.authService.register(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Успешная регистрация:', response);
        this.authService.setTokenAndUser(response.token, response);
        this.registerError = false;
        this.router.navigate(['/lobby']);
      },
      error: (err) => {
        console.error('Ошибка регистрации:', err);
        this.registerError = true;
      }
    });
  }
}
