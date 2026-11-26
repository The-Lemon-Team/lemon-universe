import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ProfilesService, RegisterProfileDto, UpdateProfileSeasonsDto } from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  @ApiOperation({ summary: 'List user and AI agent profiles' })
  findAll() {
    return this.profilesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a user/agent profile by handle' })
  @ApiBody({ type: RegisterProfileDto })
  create(@Body() dto: RegisterProfileDto) {
    return this.profilesService.create(dto);
  }

  @Patch(':id/seasons')
  @ApiOperation({ summary: 'Update Lemon Seasons credentials for a profile' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateProfileSeasonsDto })
  updateSeasonsCredentials(
    @Param('id') id: string,
    @Body() dto: UpdateProfileSeasonsDto,
  ) {
    return this.profilesService.updateSeasonsCredentials(id, dto);
  }
}
