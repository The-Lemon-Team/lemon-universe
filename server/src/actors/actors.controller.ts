import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActorsService, ListActorsQuery } from './actors.service';

@Controller('actors')
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Get()
  findAll(@Query() query: ListActorsQuery) {
    return this.actorsService.findAll(query);
  }

  @Get(':idOrHandle')
  findOne(@Param('idOrHandle') idOrHandle: string) {
    return this.actorsService.findOne(idOrHandle);
  }
}
