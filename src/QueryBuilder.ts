export class QueryBuilder {
    private selectColumns?: string[];
    private table?: string;
    private insertData?: Record<string, any>;
    private updateData?: Record<string, any>;
    private rawUpdateData?: Record<string, string>;
    private deleteTable?: string;
    private whereClauses: string[];
    private joinClauses: string[];
    private orderByColumns?: string[];
    private parameters: any[];
    private topCount?: number;
    private isDistinct: boolean;
    private output?: string;

    constructor() {
        this.whereClauses = [];
        this.joinClauses = [];
        this.parameters = [];
        this.isDistinct = false;
    }

    distinct(): QueryBuilder {
        this.isDistinct = true;
        return this;
    }

    select(columns: string[]): QueryBuilder {
        this.selectColumns = columns;
        return this;
    }

    insertInto(table: string, data: Record<string, any>): QueryBuilder {
        this.table = table;
        this.insertData = data;
        this.parameters = Object.values(data);
        return this;
    }

    insertIntoOutput(output: string): QueryBuilder {
        this.output = output;
        return this;
    }

    update(table: string, data: Record<string, any>): QueryBuilder {
        this.table = table;
        this.updateData = data;
        this.parameters = Object.values(data);
        return this;
    }

    rawUpdate(table: string, expressions: Record<string, string>) {
        this.table = table;
        this.rawUpdateData = expressions;
        return this;
    }

    deleteFrom(table: string): QueryBuilder {
        this.deleteTable = table;
        return this;
    }

    from(table: string): QueryBuilder {
        this.table = table;
        return this;
    }

    where(condition: string, value: any): QueryBuilder {
        this.whereClauses.push(condition);
        this.parameters.push(value);
        return this;
    }

    join(table: string, onCondition: string): QueryBuilder {
        this.joinClauses.push(`JOIN ${table} ON ${onCondition}`);
        return this;
    }

    leftJoin(table: string, onCondition: string): QueryBuilder {
        this.joinClauses.push(`LEFT JOIN ${table} ON ${onCondition}`);
        return this;
    }

    limit(count: number): QueryBuilder {
        this.topCount = count;
        return this;
    }

    orderBy(columns: string | string[]): QueryBuilder {
        this.orderByColumns = Array.isArray(columns) ? columns : [columns];
        return this;
    }

    build(): { query: string, parameters: any[] } {
        let query = '';

        if (this.selectColumns) {
            const distinctClause = this.isDistinct ? 'DISTINCT ' : '';
            query = `SELECT ${distinctClause}${this.selectColumns.join(', ')} ${this.table ? `FROM ${this.table}` : ''}`;
        } else if (this.insertData) {
            const columns = Object.keys(this.insertData);
            const placeholders = columns.map(() => `?`).join(', ');
            query = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES (${placeholders})`;
        } else if (this.updateData) {
            const setClauses = Object.keys(this.updateData).map(col => `${col} = ?`).join(', ');
            query = `UPDATE ${this.table} SET ${setClauses}`;
        } else if (this.rawUpdateData) {
            const setClauses = Object.keys(this.rawUpdateData).map(col => `${col} = ${this.rawUpdateData![col]}`).join(', ');
            query = `UPDATE ${this.table} SET ${setClauses}`;
        } else if (this.deleteTable) {
            query = `DELETE FROM ${this.deleteTable}`;
        }

        if (this.joinClauses.length) {
            query += ' ' + this.joinClauses.join(' ');
        }

        if (this.whereClauses.length) {
            query += ` WHERE ${this.whereClauses.join(' AND ')}`;
        }

        if (this.orderByColumns) {
            query += ` ORDER BY ${this.orderByColumns.join(', ')}`;
        }

        if (this.topCount && this.selectColumns) {
            query += ` LIMIT ${this.topCount}`;
        }

        return { query, parameters: this.parameters };
    }
}
