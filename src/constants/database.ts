import { AuthSessionEntity } from "../entities/AuthSessionEntity";
import { ClassCategoryEntity } from "../entities/ClassCategoryEntity";
import { ClassEntity } from "../entities/ClassEntity";
import { ClassMaterialEntity } from "../entities/ClassMaterialEntity";
import { ClassMaterialFileEntity } from "../entities/ClassMaterialFileEntity";
import { EbookEntity } from "../entities/EbookEntity";
import { EbookTagEntity } from "../entities/EbookTagEntity";
import { EbookTagLinkEntity } from "../entities/EbookTagLinkEntity";
import { LibraryFileEntity } from "../entities/LibraryFileEntity";
import { LibraryRoleEntity } from "../entities/LibraryRoleEntity";
import { LibraryStatusEntity } from "../entities/LibraryStatusEntity";
import { LibraryUserEntity } from "../entities/LibraryUserEntity";
import { TeachingEntity } from "../entities/TeachingEntity";

export const DATABASE_ENTITIES = [
	LibraryUserEntity,
	AuthSessionEntity,
	LibraryFileEntity,
	LibraryRoleEntity,
	LibraryStatusEntity,
	TeachingEntity,
	ClassCategoryEntity,
	ClassEntity,
	ClassMaterialEntity,
	ClassMaterialFileEntity,
	EbookEntity,
	EbookTagEntity,
	EbookTagLinkEntity
];
