import { mainDB, saltRounds, voidCallback, getTime } from './util';
import { SessionService } from './session';
import { UserService } from './user';
import * as bcrypt from 'bcrypt';

// Database login and registration services
export module LoginRegisterService {

    // Check if a login is valid
    export function validLogin(email: string, password: string, callback?: (valid: boolean, sessionId?: string) => void) {
        email = email.toLowerCase();
        var sql = `SELECT email, password FROM NBUser WHERE email = ? AND verified = 1;`;
        var params = [email];
        mainDB.execute(sql, params, (rows) => {
            if (rows.length === 0) {
                if (callback) callback(false);
            } else {
                bcrypt.compare(password, rows[0].password, (err, res) => {
                    if (err) throw err;
                    if (res) {
                        var sql = `UPDATE NBUser SET lastLogin = ? WHERE email = ?;`;
                        var params = [getTime(), email];
                        mainDB.execute(sql, params);
                        SessionService.newSessionId(email, (sessionId) => {
                            if (callback) callback(true, sessionId);
                        });
                    } else {
                        if (callback) {
                            callback(false);
                        }
                    }
                });
            }
        });
    }

    // Register a new user
    export function register(email: string, password: string, firstname: string, lastname: string, callback?: voidCallback) {
        email = email.toLowerCase();
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) throw err;
            UserService.newUserId((userId) => {
                var sql = `
                    INSERT INTO NBUser (userId, email, password, firstname, lastname, joinTimestamp, itemsListed, itemsSold, moneyMade, verified, admin) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    );`;
                var params = [userId, email, hash, firstname, lastname, getTime(), 0, 0, 0, 0, 0];
                mainDB.execute(sql, params, (rows) => {
                    if (callback) callback();
                });
            });
        });
    }

}
