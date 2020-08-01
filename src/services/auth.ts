import { mainDB, boolCallback, getTime } from './util';

// Database authentication services
export module AuthService {

    // Authorize/authenticate a user
    export function auth(sessionId: string, callback?: boolCallback) {
        var sql = `SELECT id FROM Session WHERE id = ?;`;
        var params = [sessionId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length > 0);
            if (rows.length > 0) {
                var sql = `
                    UPDATE NBUser SET lastLogin = ? WHERE id = (
                        SELECT userId FROM Session WHERE id = ?
                    );`;
                var params = [getTime(), sessionId];
                mainDB.execute(sql, params);
            }
        });
    }

    // Get the id of an authenticated user by the session ID
    export function getAuthUser(sessionId: string, callback?: (userId: number, firstname?: string, lastname?: string) => void) {
        var sql = `
            SELECT id, firstname, lastname FROM NBUser WHERE id = (
                SELECT userId FROM Session WHERE id = ?
            );`;
        var params = [sessionId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) {
                if (rows.length > 0) callback(rows[0].id, rows[0].firstname, rows[0].lastname);
                else callback(null);
            }
        });
    }

}