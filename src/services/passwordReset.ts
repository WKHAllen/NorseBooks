import { mainDB, hexLength, passwordResetTimeout, voidCallback, boolCallback, stringCallback, getTime } from './util';
import { UserService } from './user';
import * as crypto from 'crypto';

// Database password reset services
export module PasswordResetService {

    // Generate a new password reset ID
    export function newPasswordResetId(email: string, callback?: stringCallback) {
        email = email.toLowerCase();
        crypto.randomBytes(hexLength / 2, (err, buffer) => {
            if (err) throw err;
            var passwordResetId = buffer.toString('hex');
            var sql = `SELECT resetId FROM PasswordReset WHERE resetId = ?;`;
            var params = [passwordResetId];
            mainDB.execute(sql, params, (rows) => {
                if (rows.length > 0) {
                    newPasswordResetId(email, callback);
                } else {
                    var sql = `INSERT INTO PasswordReset (email, resetId, createTimestamp) VALUES (?, ?, ?);`;
                    var params = [email, passwordResetId, getTime()];
                    mainDB.execute(sql, params, (rows) => {
                        setTimeout(deletePasswordResetId, passwordResetTimeout, passwordResetId);
                        if (callback) callback(passwordResetId);
                    });
                }
            });
        });
    }
    

    // Delete a password reset ID
    export function deletePasswordResetId(passwordResetId: string, callback?: voidCallback) {
        var sql = `DELETE FROM PasswordReset WHERE resetId = ?;`;
        var params = [passwordResetId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    }
    
    // Check if a password reset ID is valid
    export function checkPasswordResetId(passwordResetId: string, callback?: boolCallback) {
        var sql = `SELECT resetId FROM PasswordReset WHERE resetId = ?;`;
        var params = [passwordResetId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length > 0);
        });
    }

    // Reset a password
    export function resetPassword(passwordResetId: string, newPassword: string, callback?: boolCallback) {
        var sql = `
            SELECT id FROM NBUser WHERE email = (
                SELECT email FROM PasswordReset WHERE resetId = ?
            );`;
        var params = [passwordResetId];
        mainDB.execute(sql, params, (rows) => {
            if (rows.length === 1) {
                UserService.setUserPassword(rows[0].id, newPassword);
                deletePasswordResetId(passwordResetId);
                if (callback) callback(true);
            } else {
                if (callback) callback(false);
            }
        });
    }

    // Check if a password reset request has already been created
    export function passwordResetExists(email: string, callback?: boolCallback) {
        var sql = `SELECT email FROM PasswordReset WHERE email = ?;`;
        var params = [email];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length > 0);
        })
    }

}
