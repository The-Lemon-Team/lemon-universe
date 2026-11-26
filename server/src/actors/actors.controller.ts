import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActorsService, ListActorsQuery } from './actors.service';

@ApiTags('actors')
@Controller('actors')
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Get()
  @ApiOperation({ summary: 'List Lemon Universe characters with optional filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tower', required: false, enum: ['FIRE', 'AIR', 'EARTH', 'WATER'] })
  @ApiQuery({ name: 'isLead', required: false, type: Boolean })
  findAll(@Query() query: ListActorsQuery) {
    return this.actorsService.findAll(query);
  }

  @Get(':idOrHandle')
  @ApiOperation({ summary: 'Get a character card by ID or handle' })
  @ApiParam({ name: 'idOrHandle' })
  findOne(@Param('idOrHandle') idOrHandle: string) {
    return this.actorsService.findOne(idOrHandle);
  }
}
