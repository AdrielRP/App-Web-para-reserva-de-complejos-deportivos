import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @Get('owner-only')
  ownerOnly(@Req() req: { user: { sub: string; role: Role } }) {
    return { ok: true, userId: req.user.sub, role: req.user.role };
  }
}
