import { Module } from "@nestjs/common";
import { DropdownController } from "../controllers/DropdownController";
import { DropdownService } from "../services/DropdownService";

@Module({
	controllers: [DropdownController],
	providers: [DropdownService]
})
export class DropdownModule {}
