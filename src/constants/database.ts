import { AnnouncementEntity } from "../entities/AnnouncementEntity";
import { AuthSessionEntity } from "../entities/AuthSessionEntity";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";
import { ClassMaterialEntity } from "../entities/ClassMaterialEntity";
import { EbookEntity } from "../entities/EbookEntity";
import { EbookTagEntity } from "../entities/EbookTagEntity";
import { EbookTagLinkEntity } from "../entities/EbookTagLinkEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { LibraryRoleEntity } from "../entities/LibraryRoleEntity";
import { LibraryStatusEntity } from "../entities/LibraryStatusEntity";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { MobileUserEntity } from "../entities/MobileUserEntity";
import { TeachingEntity } from "../entities/TeachingEntity";
import { ThumbnailEntity } from "../entities/ThumbnailEntity";

export const DATABASE_ENTITIES = [
	AnnouncementEntity,
	ThumbnailEntity,
	LibraryUserEntity,
	MobileUserEntity,
	AuthSessionEntity,
	LibraryFileEntity,
	LibraryRoleEntity,
	LibraryStatusEntity,
	TeachingEntity,
	ClassCategoryEntity,
	ClassEntity,
	ClassMaterialEntity,
	EbookEntity,
	EbookTagEntity,
	EbookTagLinkEntity
];
