import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-ai-game-page',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './ai-game-page.component.html',
  styleUrl: './ai-game-page.component.scss'
})
export class AiGamePageComponent {
  selectedDifficulty: string = '';

  constructor(private router: Router) {}

  selectDifficulty(level: string) {
    this.selectedDifficulty = level;
    console.log('Выбран уровень сложности:', level);
  }

  startGame() {
    if (this.selectedDifficulty) {
      console.log('Начинаем игру с уровнем сложности:', this.selectedDifficulty);
      // Здесь можно добавить навигацию на страницу игры
      // this.router.navigate(['/game'], { state: { difficulty: this.selectedDifficulty } });
      
      // Временно покажем alert
      alert(`Игра начинается с уровнем сложности: ${this.selectedDifficulty}`);
    }
  }
}