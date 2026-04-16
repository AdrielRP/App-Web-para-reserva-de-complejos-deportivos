export class CreateBookingDto {
  courtId!: string;

  // Opción A (UTC ISO)
  startAt?: string;

  // Opción B (hora local America/Lima)
  date?: string; // "YYYY-MM-DD"
  startLocal?: string; // "HH:mm"

  durationMin?: number; // 60/90/120
}
