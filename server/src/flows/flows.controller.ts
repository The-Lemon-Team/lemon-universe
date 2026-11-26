import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FlowsService } from './flows.service';

@ApiTags('flows')
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  findAll(@Query('profileId') profileId?: string) {
    return this.flowsService.findAll(profileId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.flowsService.updateStatus(id, status);
  }
}
