const { Pool } = require('pg');

// If an error is thrown, provide information on the error
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

// Control the database easily
class DB {
    constructor(dbURL) {
        this.pool = new Pool({
            connectionString: dbURL,
            ssl: true,
            max: 1
        });
    }

    // Execute a SQL query
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

    // Execute two SQL queries, one right after the other
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

    // Execute multiple SQL queries, each one right after the last
    executeMany(stmts, callback) {
        this.pool.connect((err, client, release) => {
            if (err) throw err;
            for (var stmt of stmts) {
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

// Export the database controller class
module.exports = {
    'DB': DB
}
