import { Component, signal, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ItineraryService } from '../../services/itinerary.service';
import { Trip, TripDay, Activity, ActivityType, TripSummary } from '../../models/itinerary.model';
import { InlineEditComponent } from '../../shared/inline-edit/inline-edit';

interface ActivityStyle {
  bgColor: string;
  borderColor: string;
}

@Component({
  selector: 'app-itinerary',
  imports: [DatePipe, InlineEditComponent],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'flex:1;display:flex;flex-direction:column;min-height:0' },
})
export class ItineraryComponent implements OnInit {
  private readonly itineraryService = inject(ItineraryService);

  trips = signal<TripSummary[]>([]);
  trip = signal<Trip | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);
  error = signal<string | null>(null);
  activeDay = signal(1);
  showAddActivity = signal<string | null>(null); // dayId for which "add" form is open
  newActivityTitle = signal('');
  showTypeDropdown = signal<string | null>(null); // activityId for which type picker is open

  readonly activityTypes: ActivityType[] = ['MEAL', 'VISIT', 'TRANSPORT', 'WALK', 'NIGHTLIFE', 'SHOW', 'SHOPPING', 'REST'];

  private readonly activityStyles: Record<string, ActivityStyle> = {
    MEAL: { bgColor: '#fef3c7', borderColor: '#f59e0b' },
    VISIT: { bgColor: '#edf2f9', borderColor: '#2d4a7a' },
    WALK: { bgColor: '#ecfdf5', borderColor: '#10b981' },
    TRANSPORT: { bgColor: '#f0f0f0', borderColor: '#9ca3af' },
    NIGHTLIFE: { bgColor: '#f3e8ff', borderColor: '#8b5cf6' },
    SHOW: { bgColor: '#fdf0ec', borderColor: '#c45d3e' },
    SHOPPING: { bgColor: '#fdf2f8', borderColor: '#ec4899' },
    REST: { bgColor: '#f0f0f0', borderColor: '#9ca3af' },
  };

  private readonly defaultStyle: ActivityStyle = { bgColor: '#fdf0ec', borderColor: '#c45d3e' };

  ngOnInit() {
    this.loadTrips();
  }

  private loadTrips() {
    this.isLoading.set(true);
    this.itineraryService.getTrips().subscribe({
      next: (trips) => {
        this.trips.set(trips);
        if (trips.length > 0) {
          this.loadTrip(trips[0].id);
        } else {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        this.error.set('Failed to load itineraries');
        this.isLoading.set(false);
        console.error(err);
      },
    });
  }

  private loadTrip(id: string) {
    this.itineraryService.getTrip(id).subscribe({
      next: (trip) => {
        this.trip.set(trip);
        this.activeDay.set(trip.days[0]?.dayNumber ?? 1);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load itinerary details');
        this.isLoading.set(false);
        console.error(err);
      },
    });
  }

  selectDay(dayNumber: number) {
    this.activeDay.set(dayNumber);
  }

  getActiveDay(): TripDay | undefined {
    return this.trip()?.days.find((d) => d.dayNumber === this.activeDay());
  }

  getMainActivities(day: TripDay): Activity[] {
    return day.activities.filter((a) => !a.alternativeToId);
  }

  getAlternatives(activityId: string, day: TripDay): Activity[] {
    return day.activities.filter((a) => a.alternativeToId === activityId);
  }

  isMinorActivity(type: string): boolean {
    return ['WALK', 'TRANSPORT', 'REST'].includes(type);
  }

  activityConfig(type: string): ActivityStyle {
    return this.activityStyles[type] ?? this.defaultStyle;
  }

  formatTime(time: string | null): string {
    return time ?? '';
  }

  formatPrice(minCents: number | null, maxCents: number | null): string {
    if (minCents === null && maxCents === null) return '';
    if (minCents === 0 && maxCents === 0) return 'Free';
    const min = minCents !== null ? (minCents / 100).toFixed(0) : null;
    const max = maxCents !== null ? (maxCents / 100).toFixed(0) : null;
    if (min && max && min !== max) return `€${min}–${max}`;
    return `€${max ?? min}`;
  }

  activityIcon(type: string): string {
    const icons: Record<string, string> = {
      MEAL: '🍽️',
      VISIT: '🏛️',
      TRANSPORT: '🚕',
      WALK: '🚶',
      NIGHTLIFE: '🌙',
      SHOW: '🎭',
      SHOPPING: '🛍️',
      REST: '😴',
    };
    return icons[type] ?? '📍';
  }

  tipIcon(category: string): string {
    const icons: Record<string, string> = {
      TRANSPORT: '🚇',
      SAFETY: '⚠️',
      BUDGET: '💰',
      PACKING: '🧳',
    };
    return icons[category] ?? '💡';
  }

  placeTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      RESTAURANT: 'Restaurant',
      MUSEUM: 'Museum',
      PARK: 'Park',
      MARKET: 'Market',
      BAR: 'Bar',
      LANDMARK: 'Landmark',
      VENUE: 'Venue',
      CHURCH: 'Church',
      ROOFTOP: 'Rooftop',
      NEIGHBORHOOD: 'Neighborhood',
    };
    return labels[type] ?? type;
  }

  // ── Inline editing methods ──────────────────────────────────────

  saveTripTitle(value: string) {
    const t = this.trip();
    if (!t || !value) return;
    this.isSaving.set(true);
    this.itineraryService.updateTrip(t.id, { title: value }).subscribe({
      next: () => {
        this.trip.set({ ...t, title: value });
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  saveDayField(dayId: string, field: 'title' | 'theme', value: string) {
    const t = this.trip();
    if (!t) return;
    this.isSaving.set(true);
    this.itineraryService.updateTripDay(t.id, dayId, { [field]: value || null }).subscribe({
      next: () => {
        this.trip.set({
          ...t,
          days: t.days.map((d) => d.id === dayId ? { ...d, [field]: value || null } : d),
        });
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  saveActivityField(activityId: string, field: 'title' | 'description' | 'startTime' | 'endTime', value: string) {
    const t = this.trip();
    if (!t) return;
    this.isSaving.set(true);
    this.itineraryService.updateActivity(t.id, activityId, { [field]: value || null }).subscribe({
      next: () => {
        this.trip.set({
          ...t,
          days: t.days.map((d) => ({
            ...d,
            activities: d.activities.map((a) => a.id === activityId ? { ...a, [field]: value || null } : a),
          })),
        });
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  changeActivityType(activityId: string, newType: ActivityType) {
    const t = this.trip();
    if (!t) return;
    this.showTypeDropdown.set(null);
    this.isSaving.set(true);
    this.itineraryService.updateActivity(t.id, activityId, { activityType: newType }).subscribe({
      next: () => {
        this.trip.set({
          ...t,
          days: t.days.map((d) => ({
            ...d,
            activities: d.activities.map((a) => a.id === activityId ? { ...a, activityType: newType } : a),
          })),
        });
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  toggleTypeDropdown(activityId: string) {
    this.showTypeDropdown.set(this.showTypeDropdown() === activityId ? null : activityId);
  }

  addActivity(dayId: string) {
    const t = this.trip();
    const title = this.newActivityTitle().trim();
    if (!t || !title) return;
    this.isSaving.set(true);
    this.itineraryService.createActivity(t.id, dayId, { title, activityType: 'VISIT' }).subscribe({
      next: (activity) => {
        this.trip.set({
          ...t,
          days: t.days.map((d) =>
            d.id === dayId
              ? { ...d, activities: [...d.activities, { ...activity, alternatives: activity.alternatives ?? [], highlights: activity.highlights ?? [] }] }
              : d,
          ),
        });
        this.showAddActivity.set(null);
        this.newActivityTitle.set('');
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  removeActivity(activityId: string) {
    if (!confirm('Delete this activity?')) return;
    const t = this.trip();
    if (!t) return;
    this.isSaving.set(true);
    this.itineraryService.deleteActivity(t.id, activityId).subscribe({
      next: () => {
        this.trip.set({
          ...t,
          days: t.days.map((d) => ({
            ...d,
            activities: d.activities.filter((a) => a.id !== activityId),
          })),
        });
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  removeDay(dayId: string) {
    if (!confirm('Delete this entire day and all its activities?')) return;
    const t = this.trip();
    if (!t) return;
    this.isSaving.set(true);
    this.itineraryService.deleteDay(t.id, dayId).subscribe({
      next: () => {
        const newDays = t.days.filter((d) => d.id !== dayId);
        this.trip.set({ ...t, days: newDays });
        if (this.activeDay() === 0 || !newDays.find((d) => d.dayNumber === this.activeDay())) {
          this.activeDay.set(newDays[0]?.dayNumber ?? 0);
        }
        this.isSaving.set(false);
      },
      error: () => this.isSaving.set(false),
    });
  }

  onNewActivityInput(event: Event) {
    this.newActivityTitle.set((event.target as HTMLInputElement).value);
  }
}
