import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Компонент страницы авторизации пользователя
 * 
 * Основные функции:
 * - Аутентификация пользователя по логину и паролю
 * - Валидация введенных данных
 * - Обработка ошибок авторизации
 * - Перенаправление в лобби после успешного входа
 * 
 * @component
 * @selector app-login-page
 * 
 * Особенности безопасности:
 * - Очистка ошибок при новом вводе
 * - Валидация обязательных полей
 * - Хранение токена через AuthService
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  /**
   * Логин пользователя
   * Используется для идентификации в системе
   */
  username = '';

  /**
   * Пароль пользователя
   * Используется для проверки подлинности
   * Передается в зашифрованном виде
   */
  password = '';

  /**
   * Флаг ошибки авторизации
   * true - неверный логин/пароль или проблемы с сервером
   * false - ошибок нет или ошибка сброшена
   */
  loginError = false;

  /**
   * Флаг пустых полей ввода
   * true - одно или оба поля не заполнены
   * false - все поля заполнены
   */
  fieldsEmpty = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Обработчик ввода в поле логина
   * Сбрасывает флаги ошибок при начале редактирования
   * 
   * Использование:
   * - Привязывается к событию input поля логина
   * - Обеспечивает мгновенную обратную связь пользователю
   */
  onUsernameInput() {
    this.loginError = false;
    this.fieldsEmpty = false;
  }

  /**
   * Обработчик ввода в поле пароля
   * Сбрасывает флаги ошибок при начале редактирования
   * 
   * Использование:
   * - Привязывается к событию input поля пароля
   * - Позволяет пользователю исправить ошибки без перезагрузки
   */
  onPasswordInput() {
    this.loginError = false;
    this.fieldsEmpty = false;
  }

  /**
   * Основной метод обработки отправки формы авторизации
   * 
   * Процесс авторизации:
   * 1. Сброс предыдущих ошибок
   * 2. Валидация заполнения обязательных полей
   * 3. Отправка запроса на сервер через AuthService
   * 4. Обработка успешного ответа (сохранение токена, навигация)
   * 5. Обработка ошибок авторизации
   * 
   * @throws {Error} При проблемах с сетью или сервером
   */
  onSubmit() {
    // Сброс состояния ошибок перед новой попыткой
    this.loginError = false;
    this.fieldsEmpty = false;

    // Валидация наличия данных в обязательных полях
    if (!this.username.trim() || !this.password) {
      this.fieldsEmpty = true;
      console.error('Все поля обязательны');
      return;
    }

    /**
     * Вызов сервиса авторизации
     * Использует RxJS Observable для асинхронной обработки
     */
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        // Успешная авторизация - сохранение токена и данных пользователя
        this.authService.setTokenAndUser(response.token, response);
        console.log('Успешная авторизация:', response);
        this.loginError = false;
        
        // Перенаправление на главную страницу приложения (лобби)
        this.router.navigate(['/lobby']);
      },
      error: (err) => {
        // Обработка ошибок авторизации
        console.error('Ошибка авторизации:', err);
        this.loginError = true;
      }
    });
  }
}