import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_PIPE, DiscoveryModule } from "@nestjs/core";
import { MysqlExceptionFilter } from "../commons/MysqlExceptionFilter";
import { createValidationPipe } from "../commons/ValidationPipe";
import { AppController } from "../controllers/AppController";
import { AuthModule } from "./AuthModule";
import { DatabaseModule } from "./DatabaseModule";
import { FilesModule } from "./FilesModule";
import { ProfileModule } from "./ProfileModule";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DiscoveryModule,
		DatabaseModule,
		AuthModule,
		FilesModule,
		ProfileModule
	],
	controllers: [AppController],
	providers: [
		{ provide: APP_FILTER, useClass: MysqlExceptionFilter },
		{ provide: APP_PIPE, useFactory: createValidationPipe }
	]
})
export class AppModule {}
