import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClassController } from "../controllers/ClassController";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";
import { ClassService } from "../services/ClassService";

@Module({
	imports: [TypeOrmModule.forFeature([ClassEntity, ClassCategoryEntity])],
	controllers: [ClassController],
	providers: [ClassService]
})
export class ClassModule {}
