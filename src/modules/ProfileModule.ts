import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProfileController } from "../controllers/ProfileController";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { ProfileService } from "../services/ProfileService";

@Module({
	imports: [TypeOrmModule.forFeature([LibraryUserEntity])],
	controllers: [ProfileController],
	providers: [ProfileService]
})
export class ProfileModule {}
