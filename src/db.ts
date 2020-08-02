import { Pool, QueryResult } from 'pg';

// If an error is thrown, provide information on the error
function logError(stmt: string, params: any[], res: QueryResult<any>, err: Error) {
    console.log('\n\n######### ERROR #########\n\n');
    console.log('\nStatement:');
    console.log(stmt);
    console.log('\nParameters:');
    console.log(params);
    console.log('\nResponse: ');
    console.log(res);
    console.log('\nError:');
    throw err;
}

// Control the database easily
export class DB {
    pool: Pool;

    constructor(dbURL: string, ssl: boolean = true, max: number = 20) {
        this.pool = new Pool({
            connectionString: dbURL,
            ssl: ssl,
            max: max
        });
    }

    // Execute a SQL query
    execute(stmt: string, params: any[], callback?: (rows: any[]) => void) {
        var paramCount = 0;
        while (stmt.includes('?')) {
            stmt = stmt.replace('?', `$${++paramCount}`);
        }
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            client.query(stmt, params, (err, res) => {
                release();
                if (err) logError(stmt, params, res, err);
                if (callback) callback(res.rows);
            });
        });
    }

    // Execute two SQL queries, one right after the other
    executeAfter(stmt: string, params: any[], callback: (rows: any[]) => void, afterStmt: string, afterParams: any[], afterCallback?: (rows: any[]) => void) {
        var paramCount = 0;
        while (stmt.includes('?')) {
            stmt = stmt.replace('?', `$${++paramCount}`);
        }
        paramCount = 0;
        while (afterStmt.includes('?')) {
            afterStmt = afterStmt.replace('?', `$${++paramCount}`);
        }
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            client.query(stmt, params, (err, res) => {
                if (err) logError(stmt, params, res, err);
                if (callback) callback(res.rows);
                client.query(afterStmt, afterParams, (err, res) => {
                    release();
                    if (err) logError(afterStmt, afterParams, res, err);
                    if (afterCallback) afterCallback(res.rows);
                });
            });
        });
    }

    // Execute multiple SQL queries, each one right after the last
    executeMany(stmts: string[], callback?: (rows: any[]) => void, doneCallback?: () => void) {
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            for (var stmt of stmts) {
                client.query(stmt, (err, res) => {
                    if (err) {
                        logError(stmt, [], res, err);
                    }
                    if (callback) callback(res.rows);
                });
            }
            release();
            if (doneCallback) doneCallback();
        });
    }
}
