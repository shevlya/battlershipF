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
  }

  startGame() {
    if (this.selectedDifficulty) {
      console.log('Начинаем игру с уровнем сложности:', this.selectedDifficulty);
      this.router.navigate(['/placement'], { state: { difficulty: this.selectedDifficulty } });
    }
  }
}