import { Module } from '@nestjs/common';
import { SavedItemsController } from './saved-items.controller';
import { SavedItemsService } from './saved-items.service';
import { PoiModule } from '../poi/poi.module';

@Module({
  imports: [PoiModule],
  controllers: [SavedItemsController],
  providers: [SavedItemsService],
})
export class SavedItemsModule {}
