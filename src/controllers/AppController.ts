import { Controller, Get } from '@nestjs/common';
import { Public } from '../commons/Public';

// Health probe — probes cannot send a bearer token, so this stays public.
@Public()
@Controller()
export class AppController {
  @Get()
  health(): string {
    return '✅ Server is running';
  }
}
