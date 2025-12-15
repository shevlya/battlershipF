import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './info-page.component.html',
  styleUrls: ['./info-page.component.scss']
})
export class InfoPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private fragmentSubscription!: Subscription;
  
  constructor(private router: Router, private activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    // Подписка на изменение фрагмента URL
    this.fragmentSubscription = this.activatedRoute.fragment.subscribe(fragment => {
      if (fragment) {
        this.scrollToFragment(fragment);
      }
    });
  }

  ngAfterViewInit() {
    // Проверяем фрагмент при загрузке страницы
    setTimeout(() => {
      this.activatedRoute.fragment.subscribe(fragment => {
        if (fragment) {
          this.scrollToFragment(fragment);
        }
      });
    }, 100);
  }

  // Метод для обработки кликов по ссылкам
  onAnchorClick(event: Event, fragment: string) {
    event.preventDefault();
    this.scrollToFragment(fragment);
    
    // Обновляем URL в адресной строке
    history.pushState(null, '', `${window.location.pathname}#${fragment}`);
  }

  private scrollToFragment(fragment: string) {
    const element = document.getElementById(fragment);
    if (element) {
      // Плавная прокрутка к элементу
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }

  ngOnDestroy() {
    if (this.fragmentSubscription) {
      this.fragmentSubscription.unsubscribe();
    }
  }
}