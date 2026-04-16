import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateComplexDto } from './dto/create-complex.dto';
import { ComplexesService } from './complexes.service';

@Controller('complexes')
export class ComplexesController {
  constructor(private complexes: ComplexesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Post()
  create(@Req() req: { user: { sub: string } }, @Body() dto: CreateComplexDto) {
    return this.complexes.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Get('mine')
  mine(@Req() req: { user: { sub: string } }) {
    return this.complexes.mine(req.user.sub);
  }
}
