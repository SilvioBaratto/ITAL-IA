import { Module } from '@nestjs/common';
import { ComuneController } from './comune.controller';
import { ComuneService } from './comune.service';

@Module({
  controllers: [ComuneController],
  providers: [ComuneService],
  exports: [ComuneService],
})
export class ComuneModule {}
