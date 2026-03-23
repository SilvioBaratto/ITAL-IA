import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Trip, TripSummary, Activity, ActivityType } from '../models/itinerary.model';

@Injectable({
  providedIn: 'root',
})
export class ItineraryService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}itineraries/`;

  getTrips(): Observable<TripSummary[]> {
    return this.http.get<TripSummary[]>(this.endpoint);
  }

  getTrip(id: string): Observable<Trip> {
    return this.http.get<Trip>(`${this.endpoint}${id}`);
  }

  updateTrip(tripId: string, data: { title?: string; city?: string }): Observable<unknown> {
    return this.http.patch(`${this.endpoint}${tripId}`, data);
  }

  updateTripDay(tripId: string, dayId: string, data: { title?: string; theme?: string | null }): Observable<unknown> {
    return this.http.patch(`${this.endpoint}${tripId}/days/${dayId}`, data);
  }

  updateActivity(tripId: string, activityId: string, data: Partial<Pick<Activity, 'title' | 'description' | 'startTime' | 'endTime' | 'activityType'>>): Observable<Activity> {
    return this.http.patch<Activity>(`${this.endpoint}${tripId}/activities/${activityId}`, data);
  }

  createActivity(tripId: string, dayId: string, data: { title: string; activityType: ActivityType }): Observable<Activity> {
    return this.http.post<Activity>(`${this.endpoint}${tripId}/days/${dayId}/activities`, data);
  }

  deleteActivity(tripId: string, activityId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}${tripId}/activities/${activityId}`);
  }

  reorderActivities(tripId: string, dayId: string, activityIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.endpoint}${tripId}/days/${dayId}/reorder`, { activityIds });
  }

  deleteDay(tripId: string, dayId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}${tripId}/days/${dayId}`);
  }
}
