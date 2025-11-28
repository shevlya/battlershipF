import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlacementRequest {
  strategy: string; // 'coastal', 'diagonal', 'halfField', 'spread', 'random'
  userId: string;
  saveToProfile: boolean;
}

export interface ShipPlacementDto {
  shipId: number;
  size: number;
  row: number; // 0-9
  col: number; // 0-9
  vertical: boolean;
}

export interface PlacementResponse {
  success: boolean;
  message: string;
  placements: ShipPlacementDto[];
  visualization?: string;
}

export interface SavePlacementRequest {
  userId: string;
  placementName: string;
  ships: ShipPlacementDto[];
}

export interface UserPlacementResponse {
  id: number;
  name: string;
  createdDate: Date;
  ships: ShipPlacementDto[];
}

@Injectable({
  providedIn: 'root'
})
export class PlacementApiService {
  private apiUrl = 'http://localhost:8080/api/placement'; // Замените на ваш бэкенд URL

  constructor(private http: HttpClient) {}

  /**
   * Генерация расстановки кораблей на сервере
   */
  generatePlacement(request: PlacementRequest): Observable<PlacementResponse> {
    return this.http.post<PlacementResponse>(`${this.apiUrl}/generate`, request);
  }

  /**
   * Сохранение пользовательской расстановки
   */
  saveUserPlacement(request: SavePlacementRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/save`, request);
  }

  /**
   * Загрузка сохраненных пользовательских расстановок
   */
  getUserPlacements(userId: string): Observable<UserPlacementResponse[]> {
    return this.http.get<UserPlacementResponse[]>(
      `${this.apiUrl}/user-placements`,
      { params: { userId } }
    );
  }
}
