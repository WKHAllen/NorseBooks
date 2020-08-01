import { mainDB, boolCallback, stringCallback, rowsCallback } from './util';

// Database contact platform services
export module PlatformService {

    // Get all available contact platforms
    export function getPlatforms(callback?: rowsCallback) {
        var sql = `SELECT id, name FROM Platform ORDER BY id;`;
        mainDB.execute(sql, [], (rows) => {
            if (callback) callback(rows);
        });
    }

    // Get the name of a contact platform by ID
    export function getPlatformName(platformId: number, callback?: stringCallback) {
        var sql = `SELECT name FROM Platform WHERE id = ?;`;
        var params = [platformId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].name);
        });
    }

    // Check if a contact platform is valid
    export function validPlatform(platformId: number, callback?: boolCallback) {
        var sql = `SELECT id FROM Platform WHERE id = ?;`;
        var params = [platformId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length === 1);
        });
    }

}
