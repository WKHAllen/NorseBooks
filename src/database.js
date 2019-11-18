const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');

var debug = true;

try {
    var processenv = require('./processenv');
} catch (ex) {
    debug = false;
}

const dbURL = process.env.DATABASE_URL || processenv.DATABASE_URL;
const saltRounds = 12;
const hexLength = 64;
const passwordResetTimeout = 60 * 60 * 1000;
const staticTablePath = 'tables';

// The database object
var mainDB = new db.DB(dbURL, !debug);

// Get the current time to the second
function getTime() {
    return Math.floor(new Date().getTime() / 1000);
}

// Get the path to a static table
function getStaticTablePath(tableName) {
    return path.join(__dirname, staticTablePath, tableName) + '.csv';
}

// Populate the static tables in the database
function populateStaticTable(tableName) {
    var sql;
    var params;
    fs.createReadStream(getStaticTablePath(tableName))
        .pipe(csv.parse({ headers: true }))
        .on('data', (row) => {
            sql = `INSERT INTO ${tableName} (id, name) VALUES (?, ?);`;
            params = [row.id, row.name];
            mainDB.execute(sql, params);
        });
}

// Initialize the database
function init() {
    // Drop static tables
    var dropDepartmentTable = `
        DROP TABLE IF EXISTS Department;
    `;
    mainDB.executeMany([dropDepartmentTable]);
    // Create tables
    var userTable = `
        CREATE TABLE IF NOT EXISTS NBUser (
            id SERIAL PRIMARY KEY,
            firstname TEXT NOT NULL,
            lastname TEXT NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            imageUrl TEXT,
            joinTimestamp INT NOT NULL,
            lastLogin INT,
            itemsListed INT NOT NULL
        );
    `;
    var departmentTable = `
        CREATE TABLE Department (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookTable = `
        CREATE TABLE IF NOT EXISTS Book (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            departmentId INT NOT NULL,
            userId INT NOT NULL,
            price NUMERIC(5,2) NOT NULL,
            condition TEXT NOT NULL,
            description TEXT,
            listedTimestamp INT NOT NULL,
            imageUrl TEXT
        );
    `;
    var bookCourseTable = `
        CREATE TABLE IF NOT EXISTS BookCourse (
            bookId INT NOT NULL,
            courseNumber INT NOT NULL
        );
    `;
    var passwordResetTable = `
        CREATE TABLE IF NOT EXISTS PasswordReset (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            resetId TEXT NOT NULL,
            createTimestamp INT NOT NULL
        );
    `;
    var verifyTable = `
        CREATE TABLE IF NOT EXISTS Verify (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            verifyId TEXT NOT NULL,
            createTimestamp INT NOT NULL
        );
    `;
    var sessionTable = `
        CREATE TABLE IF NOT EXISTS Session (
            id TEXT NOT NULL,
            userId INT NOT NULL,
            createTimestamp INT NOT NULL
        );
    `;
    mainDB.executeMany([userTable, departmentTable, bookTable, bookCourseTable, passwordResetTable, verifyTable, sessionTable]);
    // Populate static tables
    populateStaticTable('Department');
    // Remove expired password resets
    var sql = `SELECT resetId, createTimestamp FROM PasswordReset;`;
    mainDB.execute(sql, [], (err, rows) => {
        var timeRemaining;
        for (var row of rows) {
            timeRemaining = row.createTimestamp + Math.floor(passwordResetTimeout / 1000) - getTime();
            setTimeout(deletePasswordResetID, timeRemaining * 1000, row.resetid);
        }
    });
}

// Authorize/authenticate a user
function auth(sessionId, callback) {
    var sql = `SELECT id FROM Session WHERE id = ?;`;
    var params = [sessionId];
    mainDB.execute(sql, params, (err, rows) => {
        if (callback) callback(rows.length > 0);
        if (rows.length > 0) {
            sql = `
                UPDATE NBUser SET lastLogin = ? WHERE id = (
                    SELECT userId FROM Session WHERE id = ?
                );`;
            params = [getTime(), sessionId];
            mainDB.execute(sql, params);
        }
    });
}

// Check if a user exists
function userExists(email, callback) {
    var sql = `SELECT id FROM NBUser WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (err, rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Create a new session ID
function newSessionId(email, callback) {
    var sql = `
        DELETE FROM Session WHERE userId = (
            SELECT id FROM NBUser WHERE email = ?
        );`;
    var params = [email];
    mainDB.execute(sql, params, (err, rows) => {
        crypto.randomBytes(hexLength / 2, (err, buffer) => {
            if (err) throw err;
            var sessionId = buffer.toString('hex');
            var sql = `SELECT id FROM Session WHERE id = ?;`;
            var params = [sessionId];
            mainDB.execute(sql, params, (err, rows) => {
                if (rows.length > 0) {
                    newSessionId(email, callback);
                } else {
                    sql = `
                        INSERT INTO Session (id, userId, createTimestamp) VALUES (
                            ?,
                            (SELECT id FROM NBUser WHERE email = ?),
                            ?
                        );`;
                    params = [sessionId, email, getTime()];
                    mainDB.execute(sql, params, (err, rows) => {
                        if (callback) callback(sessionId);
                    });
                }
            });
        });
    });
}

// Delete a session
function deleteSession(sessionId, callback) {
    var sql = `DELETE FROM Session WHERE id = ?;`;
    var params = [sessionId];
    mainDB.execute(sql, params, (err, rows) => {
        if (callback) callback();
    });
}

// Check if a login is valid
function validLogin(email, password, callback) {
    var sql = `SELECT email, password FROM NBUser WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (err, rows) => {
        if (rows.length === 0) {
            if (callback) callback(false);
        } else {
            bcrypt.compare(password, rows[0].password, (err, res) => {
                if (err) throw err;
                if (res) {
                    sql = `UPDATE NBUser SET lastLogin = ? WHERE email = ?;`;
                    params = [getTime(), email];
                    mainDB.execute(sql, params);
                    newSessionId(email, (sessionId) => {
                        if (callback) callback(true, sessionId);
                    });
                } else if (callback) {
                    callback(false);
                }
            });
        }
    });
}

// Register a new user
function register(email, password, firstname, lastname, callback) {
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) throw err;
        var sql = `
            INSERT INTO NBUser (email, password, firstname, lastname, joinTimestamp, itemsListed) VALUES (
                ?, ?, ?, ?, ?, ?
            );`;
        var params = [email, hash, firstname, lastname, getTime(), 0];
        mainDB.execute(sql, params, (err, rows) => {
            if (callback) callback();
        });
    });
}

// Delete a password reset ID
function deletePasswordResetId(passwordResetID, callback) {
    var sql = `DELETE FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetID];
    mainDB.execute(sql, params, (err, rows) => {
        if (callback) callback();
    });
}

// Export the database control functions
module.exports = {
    'auth': auth,
    'userExists': userExists,
    'newSessionId': newSessionId,
    'deleteSession': deleteSession,
    'validLogin': validLogin,
    'register': register,
    'deletePasswordResetId': deletePasswordResetId,
    'mainDB': mainDB
}

// Initialize the database on import
init();
