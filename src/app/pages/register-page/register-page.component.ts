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
  passwordTooShort = false;
  invalidUsername = false;
  usernameTooShort = false; // Новая переменная для ошибки длины логина
  fieldsEmpty = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  // Метод для валидации логина
  validateUsername() {
    // Регулярное выражение: начинается с буквы, затем могут быть буквы, цифры, точка, подчеркивание, дефис
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
    this.invalidUsername = this.username.length > 0 && !usernameRegex.test(this.username);
    
    // Проверка минимальной длины логина
    this.usernameTooShort = this.username.length > 0 && this.username.length < 3;
  }

  // Очистка ошибок при вводе в поле логина
  onUsernameInput() {
    this.registerError = false;
    this.invalidUsername = false;
    this.usernameTooShort = false;
    this.fieldsEmpty = false;
    this.validateUsername();
  }

  // Очистка ошибок при вводе в поле пароля
  onPasswordInput() {
    this.registerError = false;
    this.passwordTooShort = false;
    this.passwordMismatch = false;
    this.fieldsEmpty = false;
  }

  // Очистка ошибок при вводе в поле подтверждения пароля
  onConfirmPasswordInput() {
    this.registerError = false;
    this.passwordMismatch = false;
    this.fieldsEmpty = false;
  }

  onSubmit() {
    // Сброс ошибок
    this.registerError = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;
    this.invalidUsername = false;
    this.usernameTooShort = false;
    this.fieldsEmpty = false;

    // Проверка на пустые поля
    if (!this.username.trim() || !this.password || !this.confirmPassword) {
      this.fieldsEmpty = true;
      console.error('Все поля обязательны');
      return;
    }

    // Валидация логина
    this.validateUsername();
    if (this.invalidUsername) {
      console.error('Логин содержит запрещенные символы');
      return;
    }

    // Валидация длины логина
    if (this.username.length < 3) {
      this.usernameTooShort = true;
      console.error('Логин должен быть не менее 3 символов');
      return;
    }

    // Валидация длины пароля
    if (this.password.length < 6) {
      this.passwordTooShort = true;
      console.error('Пароль должен быть не менее 6 символов');
      return;
    }

    // Валидация совпадения паролей
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