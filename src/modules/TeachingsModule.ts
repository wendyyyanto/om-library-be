import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SnakeCaseExceptionFilter } from "../commons/SnakeCaseExceptionFilter";
import { TeachingsController } from "../controllers/TeachingsController";
import { TeachingEntity } from "../entities/TeachingEntity";
import { TeachingsService } from "../services/TeachingsService";

@Module({
	imports: [TypeOrmModule.forFeature([TeachingEntity])],
	controllers: [TeachingsController],
	providers: [TeachingsService, SnakeCaseExceptionFilter]
})
export class TeachingsModule {}
