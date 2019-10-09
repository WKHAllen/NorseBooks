const { Pool } = require('pg');

function logError(stmt, params, res, err) {
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

class DB {
    constructor(dbURL) {
        this.pool = new Pool({
            connectionString: dbURL,
            ssl: true,
            max: 1
        });
    }

    execute(stmt, params, callback) {
        var paramCount = 0;
        while (stmt.includes('?')) {
            stmt = stmt.replace('?', `$${++paramCount}`);
        }
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            client.query(stmt, params, (err, res) => {
                release();
                if (err) logError(stmt, params, res, err);
                if (callback) callback(err, res.rows);
            });
        });
    }

    executeAfter(stmt, params, callback, afterStmt, afterParams, afterCallback) {
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
                if (callback) callback(err, res.rows);
                client.query(afterStmt, afterParams, (err, res) => {
                    release();
                    if (err) logError(afterStmt, afterParams, res, err);
                    if (afterCallback) afterCallback(err, res.rows);
                });
            });
        });
    }

    executeMany(stmts, callback) {
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            for (let stmt of stmts) {
                client.query(stmt, (err, res) => {
                    if (err) {
                        logError(stmt, [], res, err);
                    }
                    if (callback) callback(err, res.rows);
                });
            }
            release();
        });
    }
}

module.exports = {
    'DB': DB
}
