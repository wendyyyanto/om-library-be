import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_PIPE, DiscoveryModule } from "@nestjs/core";
import { MysqlExceptionFilter } from "../commons/MysqlExceptionFilter";
import { createValidationPipe } from "../commons/ValidationPipe";
import { AppController } from "../controllers/AppController";
import { AnnouncementModule } from "./AnnouncementModule";
import { AuthModule } from "./AuthModule";
import { ClassModule } from "./ClassModule";
import { DatabaseModule } from "./DatabaseModule";
import { DropdownModule } from "./DropdownModule";
import { EbookModule } from "./EbookModule";
import { FilesModule } from "./FilesModule";
import { ProfileModule } from "./ProfileModule";
import { TeachingsModule } from "./TeachingsModule";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DiscoveryModule,
		DatabaseModule,
		AnnouncementModule,
		AuthModule,
		DropdownModule,
		ClassModule,
		EbookModule,
		FilesModule,
		ProfileModule,
		TeachingsModule
	],
	controllers: [AppController],
	providers: [
		{ provide: APP_FILTER, useClass: MysqlExceptionFilter },
		{ provide: APP_PIPE, useFactory: createValidationPipe }
	]
})
export class AppModule {}
