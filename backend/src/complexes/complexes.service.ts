import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplexDto } from './dto/create-complex.dto';

@Injectable()
export class ComplexesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.complex.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(ownerId: string, dto: CreateComplexDto) {
    return this.prisma.complex.create({
      data: {
        ownerId,
        name: dto.name,
        district: dto.district,
        address: dto.address,
        phone: dto.phone,
      },
    });
  }

  mine(ownerId: string) {
    return this.prisma.complex.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
