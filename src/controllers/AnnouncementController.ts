import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { Public } from "../commons/Public";
import { AnnouncementService } from "../services/AnnouncementService";

@Public()
@Controller("announcements")
export class AnnouncementController {
	constructor(private readonly announcementService: AnnouncementService) {}

	@Get()
	async list(@Query("q") q?: string) {
		return this.announcementService.list(String(q ?? "").trim());
	}

	@Get(":id")
	async getById(@Param("id", ParseIntPipe) id: number) {
		return this.announcementService.getById(id);
	}
}
