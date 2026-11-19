import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ProfilesService, RegisterProfileDto } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  findAll() {
    return this.profilesService.findAll();
  }

  @Post()
  create(@Body() dto: RegisterProfileDto) {
    return this.profilesService.create(dto);
  }

  @Patch(':id/seasons')
  updateSeasonsCredentials(
    @Param('id') id: string,
    @Body() dto: { seasonsUserId?: string; seasonsUserKey?: string },
  ) {
    return this.profilesService.updateSeasonsCredentials(id, dto);
  }
}
