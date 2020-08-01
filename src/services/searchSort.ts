import { mainDB, boolCallback, stringCallback, rowsCallback } from './util';

// Database search sort services
export module SearchSortService {

    // Get all available search sorting options
    export function getSearchSortOptions(callback?: rowsCallback) {
        var sql = `SELECT id, name FROM SearchSort ORDER BY id;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows);
        });
    }

    // Get the name of a search sorting option by ID
    export function getSearchSortName(searchSortId: number, callback?: stringCallback) {
        var sql = `SELECT name FROM SearchSort WHERE id = ?;`;
        var params = [searchSortId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].name);
        });
    }

    // Get the ORDER BY section of a search query by ID
    export function getSearchSortQuery(searchSortId: number, callback?: stringCallback) {
        var sql = `SELECT query FROM SearchSort WHERE id = ?;`;
        var params = [searchSortId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) {
                if (rows.length > 0) callback(rows[0].query);
                else callback(null);
            }
        });
    }

    // Check if a search sorting option is valid
    export function validSearchSortOption(searchSortId: number, callback?: boolCallback) {
        var sql = `SELECT id FROM SearchSort WHERE id = ?;`;
        var params = [searchSortId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length === 1);
        });
    }

}
