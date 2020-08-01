import { mainDB, saltRounds, voidCallback, boolCallback, stringCallback, rowCallback, rowsCallback } from './util';
import * as bcrypt from 'bcrypt';

// Database user services
export module UserService {

    // Check if a user exists
    export function userExists(email: string, callback?: boolCallback) {
        email = email.toLowerCase();
        var sql = `SELECT id FROM NBUser WHERE email = ?;`;
        var params = [email];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length > 0);
        });
    }

    // Check if a user's password is correct
    export function checkPassword(userId: number, password: string, callback?: boolCallback) {
        var sql = `SELECT password FROM NBUser WHERE id = ? AND verified = 1;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            bcrypt.compare(password, rows[0].password, (err, res) => {
                if (err) throw err;
                if (callback) callback(res);
            });
        });
    }

    // Get the info of a user by session ID
    export function getUserInfo(userId: number, callback?: rowCallback) {
        var sql = `SELECT firstname, lastname, email, imageUrl, joinTimestamp, itemsListed, itemsSold, moneyMade FROM NBUser WHERE id = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0]);
        });
    }

    // Get a user's image
    export function getUserImage(userId: number, callback?: stringCallback) {
        var sql = `SELECT imageUrl FROM NBUser WHERE id = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].imageurl);
        });
    }

    // Set a user's image
    export function setUserImage(userId: number, imageUrl: string, callback?: voidCallback) {
        var sql = `UPDATE NBUser SET imageUrl = ? WHERE id = ?;`;
        var params = [imageUrl, userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    }

    // Set a user's password
    export function setUserPassword(userId: number, password: string, callback?: voidCallback) {
        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) throw err;
            var sql = `UPDATE NBUser SET password = ? WHERE id = ?;`;
            var params = [hash, userId];
            mainDB.execute(sql, params, (rows) => {
                if (callback) callback();
            });
        });
    }

    // Set a user's name
    export function setUserName(userId: number, firstname: string, lastname: string, callback?: voidCallback) {
        var sql = `UPDATE NBUser SET firstname = ?, lastname = ? WHERE id = ?`;
        var params = [firstname, lastname, userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    }

    // Check if a user has set their contact information
    export function hasContactInfo(userId: number, callback?: boolCallback) {
        var sql = `SELECT contactPlatformId, contactInfo FROM NBUser WHERE id = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].contactplatformid !== null && rows[0].contactinfo !== null);
        });
    }

    // Get a user's contact information
    export function getContactInfo(userId: number, callback?: rowCallback) {
        var sql = `SELECT contactPlatformId, contactInfo FROM NBUser WHERE id = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0]);
        });
    }

    // Set a user's contact information
    export function setContactInfo(userId: number, contactPlatformId: number, contactInfo: string, callback?: voidCallback) {
        var sql = `UPDATE NBUser SET contactPlatformId = ?, contactInfo = ? WHERE id = ?;`;
        var params = [contactPlatformId, contactInfo, userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    }

    // Get a user's currently listed books
    export function getUserBooks(userId: number, callback?: rowsCallback) {
        var sql = `
            SELECT
                Book.id AS id, bookId, title, author, departmentId,
                Department.name AS department, courseNumber, conditionId,
                Condition.name AS condition, description, price, imageUrl, ISBN10, ISBN13
            FROM Book
            JOIN Department ON Book.departmentId = Department.id
            JOIN Condition ON Book.conditionId = Condition.id
            WHERE userId = ?;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows);
        });
    }

    // Check if a user is an admin
    export function isAdmin(userId: number, callback?: boolCallback) {
        var sql = `SELECT id FROM NBUser WHERE id = ? AND admin = 1;`;
        var params = [userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length === 1);
        });
    }

}