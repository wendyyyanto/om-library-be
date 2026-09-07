import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from '../constants/database';
import { TransactionRunner } from '../utilities/TransactionRunner';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),
        entities: DATABASE_ENTITIES,
        synchronize: false,
        logging: false,
      }),
    }),
  ],
  providers: [TransactionRunner],
  exports: [TransactionRunner],
})
export class DatabaseModule {}
