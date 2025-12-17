import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPlacementPageComponent } from './ai-placement-page.component';

describe('AiPlacementPageComponent', () => {
  let component: AiPlacementPageComponent;
  let fixture: ComponentFixture<AiPlacementPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiPlacementPageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AiPlacementPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
