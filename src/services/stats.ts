import { mainDB, numberCallback } from './util';

// Database statistics services
export module StatsService {

    // Get the number of users registered
    export function getNumUsers(callback?: numberCallback) {
        var sql = `SELECT COUNT(id) FROM NBUser WHERE verified = 1;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].count);
        });
    }

    // Get the number of books on the site
    export function getNumBooks(callback?: numberCallback) {
        var sql = `SELECT COUNT(id) FROM Book;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].count);
        });
    }

    // Get the number of books sold
    export function getNumSold(callback?: numberCallback) {
        var sql = `SELECT SUM(itemsSold) FROM NBUser;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].sum);
        });
    }

    // Get the total number of books that have been listed on the site
    export function getTotalListed(callback?: numberCallback) {
        var sql = `SELECT SUM(itemsListed) FROM NBUser;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].sum);
        });
    }

    // Get the total amount of money made using the site
    export function getTotalMoneyMade(callback?: numberCallback) {
        var sql = `SELECT SUM(moneyMade) FROM NBUser;`
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].sum);
        });
    }

    // Get the number of tables in the database
    export function getNumTables(callback?: numberCallback) {
        var sql = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].count);
        });
    }

    // Get the total number of rows currently used by the database
    export function getNumRows(callback?: numberCallback) {
        var sql = `
            SELECT SUM(rows) FROM (
                SELECT
                    table_name AS table,
                    (xpath('/row/cnt/text()', xml_count))[1]::TEXT::INT as rows
                FROM (
                    SELECT
                        table_name, table_schema,
                        query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                ) t
            ) AS subq;
        `;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].sum);
        });
    }

    // Get the number of reports
    export function getNumReports(callback?: numberCallback) {
        var sql = `SELECT COUNT(id) FROM Report;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows[0].count);
        });
    }

}
