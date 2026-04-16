import { Role } from '@prisma/client';

export class RegisterDto {
  email: string;
  password: string;
  fullName: string;

  // para pruebas: si no mandas role, será USER
  role?: Role;
}
