import { Global, Module } from '@nestjs/common';
import { AzureFaceService } from './azure-face.service';

@Global()
@Module({
  providers: [AzureFaceService],
  exports: [AzureFaceService],
})
export class AzureFaceModule {}
