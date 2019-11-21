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
const base64Length = 4;
const passwordResetTimeout = 60 * 60 * 1000;
const verifyTimeout = 60 * 60 * 1000;
const staticTablePath = 'tables';

// The database object
var mainDB = new db.DB(dbURL, !debug);

// Get the current time to the second
function getTime() {
    return Math.floor(new Date().getTime() / 1000);
}

// Check if a table is empty
function tableEmpty(tableName, callback) {
    var sql = `SELECT id FROM ${tableName};`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows.length === 0);
    });
}

// Get the path to a static table
function getStaticTablePath(tableName) {
    return path.join(__dirname, staticTablePath, tableName) + '.csv';
}

// Populate the static tables in the database
function populateStaticTable(tableName) {
    tableEmpty(tableName, (empty) => {
        if (empty) {
            fs.createReadStream(getStaticTablePath(tableName))
                .pipe(csv.parse({ headers: true }))
                .on('data', (row) => {
                    var sql = `INSERT INTO ${tableName} (id, name) VALUES (?, ?);`;
                    var params = [row.id, row.name];
                    mainDB.execute(sql, params);
                });
        }
    });
}

// Generate a new hex id
function newHexId(callback, length) {
    length = length !== undefined ? length : hexLength;
    crypto.randomBytes(Math.floor(length / 2), (err, buffer) => {
        if (err) throw err;
        if (callback) callback(buffer.toString('hex'));
    });
}

// Generate a new base64 id
function newBase64Id(callback, length) {
    length = length !== undefined ? length : base64Length;
    crypto.randomBytes(length, (err, buffer) => {
        if (err) throw err;
        var base64Id = buffer.toString('base64').slice(0, length);
        while (base64Id.includes('/')) base64Id = base64Id.replace('/', '-');
        while (base64Id.includes('+')) base64Id = base64Id.replace('+', '_');
        if (callback) callback(base64Id);
    });
}

// Initialize the database
function init() {
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
            itemsListed INT NOT NULL,
            verified INT NOT NULL
        );
    `;
    var departmentTable = `
        CREATE TABLE IF NOT EXISTS Department (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var conditionTable = `
        CREATE TABLE IF NOT EXISTS Condition (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL
        );
    `;
    var bookTable = `
        CREATE TABLE IF NOT EXISTS Book (
            id SERIAL PRIMARY KEY,
            bookId TEXT NOT NULL,
            name TEXT NOT NULL,
            author TEXT NOT NULL,
            departmentId INT NOT NULL,
            courseNumber INT,
            userId INT NOT NULL,
            price NUMERIC(5,2) NOT NULL,
            conditionId INT NOT NULL,
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
    mainDB.executeMany([userTable, departmentTable, conditionTable, bookTable, bookCourseTable, passwordResetTable, verifyTable, sessionTable]);
    // Populate static tables
    populateStaticTable('Department');
    populateStaticTable('Condition');
    // Remove expired password resets
    var timeRemaining;
    var sql = `SELECT resetId, createTimestamp FROM PasswordReset;`;
    mainDB.execute(sql, [], (rows) => {
        for (var row of rows) {
            timeRemaining = row.createtimestamp + Math.floor(passwordResetTimeout / 1000) - getTime();
            setTimeout(deletePasswordResetID, timeRemaining * 1000, row.resetid);
        }
    });
    // Remove expired verification entries
    sql = `SELECT verifyId, createTimestamp FROM Verify;`;
    mainDB.execute(sql, [], (rows) => {
        for (var row of rows) {
            timeRemaining = row.createtimestamp + Math.floor(verifyTimeout / 1000) - getTime();
            setTimeout(pruneUnverified, timeRemaining * 1000, row.verifyid);
        }
    });
}

// Authorize/authenticate a user
function auth(sessionId, callback) {
    var sql = `SELECT id FROM Session WHERE id = ?;`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
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

// Get the id of an authenticated user by the session ID
function getAuthUser(sessionId, callback) {
    var sql = `
        SELECT id FROM NBUser WHERE id = (
            SELECT userId FROM Session WHERE id = ?
        );`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].id);
    });
}

// Check if a user exists
function userExists(email, callback) {
    email = email.toLowerCase();
    var sql = `SELECT id FROM NBUser WHERE email = ? AND verified = 1;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Create a new email verification ID
function newVerifyId(email, callback) {
    email = email.toLowerCase();
    var sql = `DELETE FROM Verify WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        newHexId((verifyId) => {
            sql = `SELECT id FROM Verify WHERE verifyId = ?;`;
            params = [verifyId];
            mainDB.execute(sql, params, (rows) => {
                if (rows.length > 0) {
                    newVerifyId(email, callback);
                } else {
                    sql = `INSERT INTO Verify (email, verifyId, createTimestamp) VALUES (?, ?, ?);`;
                    params = [email, verifyId, getTime()];
                    mainDB.execute(sql, params, (rows) => {
                        setTimeout(pruneUnverified, verifyTimeout, verifyId);
                        if (callback) callback(verifyId);
                    });
                }
            });
        });
    });
}

// Check a verify ID
function checkVerifyID(verifyId, callback) {
    var sql = `SELECT verifyId FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Mark a user as verified
function setVerified(verifyId, callback) {
    var sql = `
        UPDATE NBUser SET verified = 1 WHERE email = (
            SELECT email FROM Verify WHERE verifyId = ?
        );`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Delete a verify ID
function deleteVerifyID(verifyId, callback) {
    var sql = `DELETE FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Prune an unverified account
function pruneUnverified(verifyId, callback) {
    var sql = `
        DELETE FROM NBUser WHERE email = (
            SELECT email FROM Verify WHERE verifyId = ?
        ) AND verified = 0;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        deleteVerifyID(verifyId);
    });
}

// Create a new session ID
function newSessionId(email, callback) {
    email = email.toLowerCase();
    var sql = `
        DELETE FROM Session WHERE userId = (
            SELECT id FROM NBUser WHERE email = ?
        );`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        newHexId((sessionId) => {
            sql = `SELECT id FROM Session WHERE id = ?;`;
            params = [sessionId];
            mainDB.execute(sql, params, (rows) => {
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
                    mainDB.execute(sql, params, (rows) => {
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
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Check if a login is valid
function validLogin(email, password, callback) {
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
    email = email.toLowerCase();
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) throw err;
        var sql = `
            INSERT INTO NBUser (email, password, firstname, lastname, joinTimestamp, itemsListed, verified) VALUES (
                ?, ?, ?, ?, ?, ?, ?
            );`;
        var params = [email, hash, firstname, lastname, getTime(), 0, 0];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    });
}

// Delete a password reset ID
function deletePasswordResetId(passwordResetID, callback) {
    var sql = `DELETE FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetID];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Create a new book id
function newBookId(callback, length) {
    newBase64Id((bookId) => {
        var sql = `SELECT id FROM Book WHERE bookId = ?;`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (rows.length > 0) {
                newBookId(callback, length);
            } else {
                if (callback) callback(bookId);
            }
        });
    }, length);
}

// Add a new book
function newBook(name, author, departmentId, courseNumber, condition, description, userId, price, imageUrl, callback) {
    newBookId((bookId) => {
        var sql = `
            INSERT INTO Book (
                bookId, name, author, departmentId, courseNumber, conditionId, description, userId, price, listedTimestamp, imageUrl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        var params = [bookId, name, author, departmentId, courseNumber, condition, description, userId, price, getTime(), imageUrl];
        var sqlAfter = `SELECT id FROM Book ORDER BY listedTimestamp DESC LIMIT 1;`;
        mainDB.executeAfter(sql, params, null, sqlAfter, [], (rows) => {
            if (callback) callback(rows[0].id, bookId);
        });
    });
}

// Get all departments
function getDepartments(callback) {
    var sql = `SELECT id, name FROM Department ORDER BY name;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Check if a department is valid
function validDepartment(departmentId, callback) {
    var sql = `SELECT id FROM Department WHERE id = ?;`;
    var params = [departmentId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Get all book conditions
function getConditions(callback) {
    var sql = `SELECT id, name FROM Condition ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Check if a book condition is valid
function validCondition(conditionId, callback) {
    var sql = `SELECT id FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Initialize the database on import
init();

// Export the database control functions
module.exports = {
    'auth': auth,
    'getAuthUser': getAuthUser,
    'userExists': userExists,
    'newVerifyId': newVerifyId,
    'checkVerifyID': checkVerifyID,
    'setVerified': setVerified,
    'deleteVerifyID': deleteVerifyID,
    'pruneUnverified': pruneUnverified,
    'newSessionId': newSessionId,
    'deleteSession': deleteSession,
    'validLogin': validLogin,
    'register': register,
    'deletePasswordResetId': deletePasswordResetId,
    'newBookId': newBookId,
    'newBook': newBook,
    'getDepartments': getDepartments,
    'validDepartment': validDepartment,
    'getConditions': getConditions,
    'validCondition': validCondition,
    'mainDB': mainDB
};
