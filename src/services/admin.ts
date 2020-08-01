import { mainDB, rowsCallback } from './util';

// Database admin services
export module AdminService {

    // Get the names of the tables in the database
    export function getTables(callback?: (tables: string[]) => void) {
        var sql = `SELECT table_name AS table FROM information_schema.tables WHERE table_schema = 'public';`;
        mainDB.execute(sql, [], (rows) => {
            var tables = [];
            for (var row of rows) tables.push(row.table);
            if (callback) callback(tables);
        });
    }

    // Get the names of the columns in a table
    export function getColumns(table: string, callback?: (columns: string[]) => void) {
        var sql = `SELECT column_name AS column FROM information_schema.columns WHERE table_name = '${table.toLowerCase()}';`;
        mainDB.execute(sql, [], (rows) => {
            var columns = [];
            for (var row of rows) columns.push(row.column);
            if (callback) callback(columns);
        });
    }

    // Get the number of rows in each table in the database
    export function getRowCount(callback?: rowsCallback) {
        var sql = `
            SELECT
                table_name AS table,
                (xpath('/row/cnt/text()', xml_count))[1]::TEXT::INT as rows
            FROM (
                SELECT
                    table_name, table_schema,
                    query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
                FROM information_schema.tables
                WHERE table_schema = 'public'
            ) t;
        `;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows);
        });
    }

    // Get all reports
    export function getReports(callback?: rowsCallback) {
        var sql = `
            SELECT
                NBUser.firstname AS firstname,
                NBUser.lastname AS lastname,
                Book.bookId AS bookId,
                Book.title AS title,
                reportTimestamp
            FROM Report
            JOIN NBUser ON Report.userId = NBUser.id
            JOIN Book ON Report.bookId = Book.id
            ORDER BY Book.id, reportTimestamp;
        `;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows);
        });
    }

    // Execute a query
    export function executeSelect(queryInputs: any, callback?: rowsCallback) {
        var select = 'SELECT';
        if (queryInputs.columns) {
            var select = 'SELECT ' + queryInputs.columns.join(', ');
        }
        var from = `FROM ${queryInputs.table}`;
        var where = '';
        if (queryInputs.where && queryInputs.whereOperator && queryInputs.whereValue) {
            where = `WHERE ${queryInputs.where} ${queryInputs.whereOperator} '${queryInputs.whereValue}'`;
        }
        var orderBy = '';
        if (queryInputs.orderBy && queryInputs.orderByDirection) {
            orderBy = `ORDER BY ${queryInputs.orderBy} ${queryInputs.orderByDirection}`;
        }
        var query = [select, from, where, orderBy].join(' ') + ';';
        while (query.includes('  ')) query = query.replace('  ', ' ');
        mainDB.execute(query, [], (rows) => {
            if (callback) callback(rows);
        });
    }

    // Get relevant information on all users
    export function getUsers(orderBy: string, orderDirection: string, callback?: rowsCallback) {
        var sql = `
            SELECT
                firstname, lastname, email, joinTimestamp,
                itemsListed, itemsSold, moneyMade
            FROM NBUser
            WHERE verified = 1
            ORDER BY ${orderBy} ${orderDirection};
        `;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows);
        });
    }

}
