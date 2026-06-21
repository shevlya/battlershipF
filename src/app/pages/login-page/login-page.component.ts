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

    // Более строгая валидация
    const trimmedUsername = this.username.trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      this.fieldsEmpty = true;
      console.error('Логин должен содержать минимум 3 символа');
      return;
    }

    if (!this.password || this.password.length < 3) {
      this.fieldsEmpty = true;
      console.error('Пароль должен содержать минимум 3 символа');
      return;
    }


    // Отображение состояния загрузки
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.textContent = 'Вход...';
    }

    /**
     * Вызов сервиса авторизации
     */
    this.authService.login(trimmedUsername, this.password).subscribe({
      next: (response) => {
        // Успешная авторизация
        this.authService.setTokenAndUser(response.token, response);
        console.log('Успешная авторизация:', response);
        this.loginError = false;

        // Сброс формы
        this.username = '';
        this.password = '';

        // Перенаправление на главную страницу
        setTimeout(() => {
          this.router.navigate(['/lobby']);
        }, 100);
      },
      error: (err) => {
        // Обработка ошибок авторизации
        console.error('Ошибка авторизации:', err);
        this.loginError = true;

        // Восстановление кнопки
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          submitBtn.textContent = 'Войти';
        }

        // Более информативное сообщение об ошибке
        let errorMessage = 'Ошибка авторизации';
        if (err.status === 401) {
          errorMessage = 'Неверный логин или пароль';
        } else if (err.status === 0) {
          errorMessage = 'Сервер недоступен. Проверьте подключение';
        }
        console.error(errorMessage);
      },
      complete: () => {
        // Восстановление кнопки в любом случае
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          submitBtn.textContent = 'Войти';
        }
      }
    });
  }
}
