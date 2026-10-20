import { Module } from '@nestjs/common';
import { AllowedOriginsController } from './allowed-origins.controller.js';
import { AllowedOriginsService } from './allowed-origins.service.js';

@Module({
  controllers: [AllowedOriginsController],
  providers: [AllowedOriginsService],
  exports: [AllowedOriginsService],
})
export class AllowedOriginsModule {}
