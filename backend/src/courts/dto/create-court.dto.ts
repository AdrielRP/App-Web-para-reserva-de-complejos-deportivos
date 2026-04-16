export class CreateCourtDto {
  complexId: string;
  name: string;
  sport: string; // ej: "FOOTBALL", "TENNIS" (por ahora string)
  pricePerHour: number;
  isActive?: boolean;
}
