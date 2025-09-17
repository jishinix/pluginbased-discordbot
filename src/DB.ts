import { DatabaseSettingsOptions } from "./DiscordBot";

import mysql from "mysql2";

export default (settings: DatabaseSettingsOptions)=>{
    return (
        mysql.createPool({
            host: settings.url,
            port: settings.port,
            user: settings.user,
            password: settings.pw,
            database: settings.database,
            multipleStatements: true
        }).promise()
    )
}


/*
import mysql, { Pool } from 'mysql2/promise';

export default class DatabaseService {
    private pool: Pool;

    constructor(settings: DatabaseSettingsOptions) {
        this.pool = mysql.createPool({
            host: settings.url,
            port: settings.port,
            user: settings.user,
            password: settings.pw,
            database: settings.database,
            multipleStatements: true
        });
    }

    public async query<T>(query: string, parameters: any[] = []): Promise<T> {
        const [rows] = await this.pool.execute(query, parameters);
        return rows as T;
    }

    public async close(): Promise<void> {
        await this.pool.end();
    }
}
*/