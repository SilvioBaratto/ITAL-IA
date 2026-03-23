import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ItineraryService } from './itinerary.service';
import { TripResponseDto } from './dto/upload-itinerary.dto';
import {
  UpdateTripDto,
  UpdateTripDayDto,
  UpdateActivityDto,
  CreateActivityDto,
  ReorderActivitiesDto,
} from './dto/update-itinerary.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Itinerary')
@ApiBearerAuth()
@Controller('itineraries')
export class ItineraryController {
  private readonly logger = new Logger(ItineraryController.name);

  constructor(private readonly itineraryService: ItineraryService) {}

  @Get()
  @ApiOperation({ summary: 'List all trips for the authenticated user' })
  async getTrips(@Request() req: any) {
    const userId = req.user.id;
    return this.itineraryService.getTripsForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single trip by ID with all nested data' })
  async getTripById(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    return this.itineraryService.getTripById(id, userId);
  }

  @Public() // TODO: remove after testing
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload PDF itinerary and extract structured data' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file containing travel itinerary',
        },
      },
      required: ['file'],
    },
  })
  async uploadItinerary(
    @UploadedFile() file: any,
    @Request() req: any,
  ): Promise<TripResponseDto> {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    // Extract userId from authenticated request
    // The SupabaseAuthGuard should have set req.user
    const userId = req.user?.id || req.user?.sub || '754310ad-faa5-4866-8290-a1a46b32e00e'; // TODO: remove fallback after testing

    this.logger.log(`Processing PDF upload for user ${userId}: ${file.originalname}`);

    const trip = await this.itineraryService.uploadPdfAndExtract(file.buffer, userId);

    return trip as TripResponseDto;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update trip title/city' })
  async updateTrip(
    @Param('id') id: string,
    @Body() body: UpdateTripDto,
    @Request() req: any,
  ) {
    return this.itineraryService.updateTrip(id, body, req.user.id);
  }

  @Patch(':tripId/days/:dayId')
  @ApiOperation({ summary: 'Update a trip day' })
  async updateTripDay(
    @Param('tripId') tripId: string,
    @Param('dayId') dayId: string,
    @Body() body: UpdateTripDayDto,
    @Request() req: any,
  ) {
    return this.itineraryService.updateTripDay(tripId, dayId, body, req.user.id);
  }

  @Patch(':tripId/activities/:activityId')
  @ApiOperation({ summary: 'Update an activity' })
  async updateActivity(
    @Param('tripId') tripId: string,
    @Param('activityId') activityId: string,
    @Body() body: UpdateActivityDto,
    @Request() req: any,
  ) {
    return this.itineraryService.updateActivity(tripId, activityId, body, req.user.id);
  }

  @Post(':tripId/days/:dayId/activities')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new activity in a day' })
  async createActivity(
    @Param('tripId') tripId: string,
    @Param('dayId') dayId: string,
    @Body() body: CreateActivityDto,
    @Request() req: any,
  ) {
    return this.itineraryService.createActivity(tripId, dayId, body, req.user.id);
  }

  @Delete(':tripId/activities/:activityId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an activity' })
  async deleteActivity(
    @Param('tripId') tripId: string,
    @Param('activityId') activityId: string,
    @Request() req: any,
  ) {
    await this.itineraryService.deleteActivity(tripId, activityId, req.user.id);
  }

  @Put(':tripId/days/:dayId/reorder')
  @ApiOperation({ summary: 'Reorder activities in a day' })
  async reorderActivities(
    @Param('tripId') tripId: string,
    @Param('dayId') dayId: string,
    @Body() body: ReorderActivitiesDto,
    @Request() req: any,
  ) {
    await this.itineraryService.reorderActivities(tripId, dayId, body.activityIds, req.user.id);
  }

  @Delete(':tripId/days/:dayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a day from a trip' })
  async deleteDay(
    @Param('tripId') tripId: string,
    @Param('dayId') dayId: string,
    @Request() req: any,
  ) {
    await this.itineraryService.deleteDay(tripId, dayId, req.user.id);
  }
}
