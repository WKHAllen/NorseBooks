import { mainDB, voidCallback, rowCallback } from './util';
import { VerificationService } from './verification';

// Miscellaneous database services
export module MiscService {

    // Get the info necessary for rendering the navbar
    export function getNavInfo(sessionId: string, callback?: rowCallback) {
        var sql = `
            SELECT id, userId, firstname, admin FROM NBUser WHERE id = (
                SELECT userId FROM Session WHERE id = ?
            );`;
        var params = [sessionId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0]);
        });
    }

    // Prune an unverified account
    export function pruneUnverified(verifyId: string, callback?: voidCallback) {
        var sql = `
            DELETE FROM NBUser WHERE email = (
                SELECT email FROM Verify WHERE verifyId = ?
            ) AND verified = 0;`;
        var params = [verifyId];
        mainDB.execute(sql, params, (rows) => {
            VerificationService.deleteVerifyId(verifyId);
            if (callback) callback();
        });
    }

}
