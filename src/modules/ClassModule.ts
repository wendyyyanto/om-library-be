import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClassController } from "../controllers/ClassController";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";
import { ClassMaterialEntity } from "../entities/ClassMaterialEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { ClassService } from "../services/ClassService";
import { FilesModule } from "./FilesModule";

@Module({
	imports: [
		TypeOrmModule.forFeature([
			ClassEntity,
			ClassCategoryEntity,
			ClassMaterialEntity,
					LibraryFileEntity
		]),
		FilesModule
	],
	controllers: [ClassController],
	providers: [ClassService]
})
export class ClassModule {}
