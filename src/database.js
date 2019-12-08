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
const maxDBClients = 20;
const saltRounds = 12;
const hexLength = 64;
const base64Length = 4;
const passwordResetTimeout = 60 * 60 * 1000; // one hour
const verifyTimeout = 60 * 60 * 1000; // one hour
const reportTimeout = 60 * 60 * 1000; // one hour
const sessionTimeout = 14 * 24 * 60 * 60 * 1000; // two weeks
const feedbackTimeout = 7 * 24 * 60 * 60 * 1000; // one week
const staticTablePath = 'tables';
const maxReports = 5;
const booksPerQuery = 24;

// The database object
var mainDB = new db.DB(dbURL, !debug, maxDBClients);

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
            contactPlatform TEXT,
            contactInfo TEXT,
            joinTimestamp INT NOT NULL,
            lastLogin INT,
            itemsListed INT NOT NULL,
            verified INT NOT NULL,
            lastFeedbackTimestamp INT
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
            title TEXT NOT NULL,
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
    var reportTable = `
        CREATE TABLE IF NOT EXISTS Report (
            id SERIAL PRIMARY KEY,
            bookId INT NOT NULL,
            userId INT NOT NULL,
            reportTimestamp INT NOT NULL
        );
    `;
    mainDB.executeMany([userTable, departmentTable, conditionTable, bookTable, passwordResetTable, verifyTable, sessionTable, reportTable]);
    // Populate static tables
    populateStaticTable('Department');
    populateStaticTable('Condition');
    // Remove expired password resets
    var timeRemaining;
    var sql = `SELECT resetId, createTimestamp FROM PasswordReset;`;
    mainDB.execute(sql, [], (rows) => {
        for (var row of rows) {
            timeRemaining = row.createtimestamp + Math.floor(passwordResetTimeout / 1000) - getTime();
            setTimeout(deletePasswordResetId, timeRemaining * 1000, row.resetid);
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
    // Prune old sessions
    sql = `SELECT id, createTimestamp FROM Session;`;
    mainDB.execute(sql, [], (rows) => {
        for (var row of rows) {
            timeRemaining = row.createtimestamp + Math.floor(sessionTimeout / 1000) - getTime();
            setTimeout(deleteSession, timeRemaining * 1000, row.id);
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

// Check if a user exists
function userExists(email, callback) {
    email = email.toLowerCase();
    var sql = `SELECT id FROM NBUser WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Check if a user's password is correct
function checkPassword(userId, password, callback) {
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
function getUserInfo(userId, callback) {
    var sql = `SELECT firstname, lastname, email, imageUrl, contactPlatform, contactInfo, joinTimestamp, itemsListed FROM NBUser WHERE id = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Get a user's image
function getUserImage(userId, callback) {
    var sql = `SELECT imageUrl FROM NBUser WHERE id = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].imageurl);
    });
}

// Set a user's image
function setUserImage(userId, imageUrl, callback) {
    var sql = `UPDATE NBUser SET imageUrl = ? WHERE id = ?;`;
    var params = [imageUrl, userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Set a user's password
function setUserPassword(userId, password, callback) {
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) throw err;
        var sql = `UPDATE NBUser SET password = ? WHERE id = ?;`;
        var params = [hash, userId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    });
}

// Check if a user has set their contact information
function hasContactInfo(userId, callback) {
    var sql = `SELECT contactPlatform, contactInfo FROM NBUser WHERE id = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].contactplatform !== null && rows[0].contactinfo !== null);
    });
}

// Set a user's contact information
function setContactInfo(userId, contactPlatform, contactInfo, callback) {
    var sql = `UPDATE NBUser SET contactPlatform = ?, contactInfo = ? WHERE id = ?;`;
    var params = [contactPlatform, contactInfo, userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Get the info necessary for rendering the navbar
function getNavInfo(sessionId, callback) {
    var sql = `
        SELECT id, imageUrl FROM NBUser WHERE id = (
            SELECT userId FROM Session WHERE id = ?
        );`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
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
function checkVerifyId(verifyId, callback) {
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
function deleteVerifyId(verifyId, callback) {
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
        deleteVerifyId(verifyId);
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
                        setTimeout(deleteSession, sessionTimeout, sessionId);
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

// Generate a new password reset ID
function newPasswordResetId(email, callback) {
    email = email.toLowerCase();
    crypto.randomBytes(hexLength / 2, (err, buffer) => {
        if (err) throw err;
        var resetId = buffer.toString('hex');
        var sql = `SELECT resetId FROM PasswordReset WHERE resetId = ?;`;
        var params = [resetId];
        mainDB.execute(sql, params, (rows) => {
            if (rows.length > 0) {
                newPasswordResetID(email, callback);
            } else {
                sql = `INSERT INTO PasswordReset (email, resetId, createTimestamp) VALUES (?, ?, ?);`;
                params = [email, resetId, getTime()];
                mainDB.execute(sql, params, (rows) => {
                    setTimeout(deletePasswordResetId, passwordResetTimeout, resetId);
                    if (callback) callback(resetId);
                });
            }
        });
    });
}

// Check if a password reset ID is valid
function checkPasswordResetId(passwordResetId, callback) {
    var sql = `SELECT resetId FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Delete a password reset ID
function deletePasswordResetId(passwordResetId, callback) {
    var sql = `DELETE FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Reset a password
function resetPassword(passwordResetId, newPassword) {
    var sql = `
        SELECT id FROM NBUser WHERE email = (
            SELECT email FROM PasswordReset WHERE resetId = ?
        );`;
    var params = [passwordResetId];
    mainDB.execute(sql, params, (rows) => {
        if (rows.length === 1) {
            setUserPassword(rows[0].id, newPassword);
            deletePasswordResetId(passwordResetId);
        }
    });
}

// Check if a password reset request has already been created
function passwordResetExists(email, callback) {
    var sql = `SELECT email FROM PasswordReset WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    })
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
function newBook(title, author, departmentId, courseNumber, condition, description, userId, price, imageUrl, callback) {
    newBookId((bookId) => {
        var sql = `
            INSERT INTO Book (
                bookId, title, author, departmentId, courseNumber, conditionId, description, userId, price, listedTimestamp, imageUrl
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        var params = [bookId, title, author, departmentId, courseNumber, condition, description, userId, price, getTime(), imageUrl];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(bookId);
            sql = `UPDATE NBUser SET itemsListed = itemsListed + 1 WHERE id = ?;`;
            params = [userId];
            mainDB.execute(sql, params);
        });
    });
}

// Check if a book is valid
function validBook(bookId, callback) {
    var sql = `SELECT id FROM Book WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Get information on a book
function getBookInfo(bookId, callback) {
    var sql = `SELECT id, title, author, departmentId, courseNumber, conditionId, description, price, imageUrl FROM Book WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Get information on the user who listed a book
function getUserBookInfo(bookId, callback) {
    var sql = `
        SELECT id, firstname, lastname, contactPlatform, contactInfo FROM NBUser WHERE id = (
            SELECT userId FROM Book WHERE bookId = ?
        );`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Get the number of departments
function getNumBooks(userId, callback) {
    var sql = `SELECT id FROM Book WHERE userId = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length);
    });
}

// Delete a book
function deleteBook(userId, bookId, callback) {
    var sql = `DELETE FROM Book WHERE id = ? AND userId = ?;`;
    var params = [bookId, userId];
    mainDB.execute(sql, params, (rows) => {
        sql = `DELETE FROM Report WHERE bookId = ?;`;
        params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    });
}

// Get info on books searched
function searchBooks(options, lastBookId, callback) {
    var params = [];
    var searchQuery = '';
    if (Object.keys(options).length > 0) {
        var searchOptions = [];
        for (var option in options) {
            if (option === 'title' || option === 'author') {
                searchOptions.push(` LOWER(${option}) LIKE LOWER(?)`);
                params.push(`%${options[option]}%`);
            } else {
                searchOptions.push(` ${option} = ?`);
                params.push(options[option]);
            }
        }
        searchQuery = ' WHERE' + searchOptions.join(' AND');
        if (lastBookId) {
            // Get books before specified book
            searchQuery += `
                AND listedTimestamp < (
                    SELECT listedTimestamp FROM Book WHERE bookId = ?
                )`;
            params.push(lastBookId);
        }
    } else {
        if (lastBookId) {
            // Get books before specified book
            searchQuery = `
                WHERE listedTimestamp < (
                    SELECT listedTimestamp FROM Book WHERE bookId = ?
                )`;
            params.push(lastBookId);
        }
    }
    var sql = `
        SELECT bookId, title, author, departmentId, Department.name AS department, courseNumber, price, imageUrl FROM Book
        JOIN Department ON Book.departmentId = Department.id
        ${searchQuery} ORDER BY listedTimestamp DESC LIMIT ?;`;
    // Limit the number of books queried
    params.push(booksPerQuery);
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows);
    });
}

// Get the id of the person who listed a book
function bookLister(bookId, callback) {
    var sql = `SELECT userId FROM Book WHERE id = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].userid);
    });
}

// Report a book
function reportBook(userId, bookId, callback) {
    var sql = `INSERT INTO Report (bookId, userId, reportTimestamp) VALUES (?, ?, ?);`;
    var params = [bookId, userId, getTime()];
    mainDB.execute(sql, params, (rows) => {
        numBookReports(bookId, (reports) => {
            bookLister(bookId, (listerId) => {
                if (reports >= maxReports) {
                    deleteBook(listerId, bookId);
                    if (callback) callback(true);
                } else {
                    if (callback) callback(false);
                }
            });
        });
    });
}

// Check if a user has already reported a book
function userReportedBook(userId, bookId, callback) {
    var sql = `SELECT id FROM Report WHERE bookId = ? AND userId = ?;`;
    var params = [bookId, userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Check if a user has reported a book recently
function userReportedRecently(userId, callback) {
    var sql = `SELECT id FROM Report WHERE userId = ? AND reportTimestamp > ?;`;
    var params = [userId, getTime() - Math.floor(reportTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Get the number of reports on a book
function numBookReports(bookId, callback) {
    var sql = `SELECT id FROM Report WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length);
    });
}

// Get all departments
function getDepartments(callback) {
    var sql = `SELECT id, name FROM Department ORDER BY name;`;
    mainDB.execute(sql, [], (rows) => {
        rows.push({ id: -1, name: 'Other' });
        if (callback) callback(rows);
    });
}

// Get the name of a department by ID
function getDepartmentName(departmentId, callback) {
    if (departmentId === -1) {
        if (callback) callback('Other');
    } else {
        var sql = `SELECT name FROM Department WHERE id = ?;`;
        var params = [departmentId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows[0].name);
        });
    }
}

// Check if a department is valid
function validDepartment(departmentId, callback) {
    if (departmentId === -1) {
        if (callback) callback(true);
    } else {
        var sql = `SELECT id FROM Department WHERE id = ?;`;
        var params = [departmentId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(rows.length === 1);
        });
    }
}

// Get all book conditions
function getConditions(callback) {
    var sql = `SELECT id, name FROM Condition ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get the name of a condition by ID
function getConditionName(conditionId, callback) {
    var sql = `SELECT name FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].name);
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

// Check if a user can provide feedback
function canProvideFeedback(userId, callback) {
    var sql = `SELECT id FROM NBUser WHERE id = ? AND (lastFeedbackTimestamp < ? OR lastFeedbackTimestamp IS NULL);`;
    var params = [userId, getTime() - Math.floor(feedbackTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Update a user's feedback timestamp to the current time
function updateFeedbackTimestamp(userId, callback) {
    var sql = `UPDATE NBUser SET lastFeedbackTimestamp = ? WHERE id = ?;`;
    var params = [getTime(), userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Initialize the database on import
init();

// Export the database control functions
module.exports = {
    'auth': auth,
    'getAuthUser': getAuthUser,
    'userExists': userExists,
    'checkPassword': checkPassword,
    'getUserInfo': getUserInfo,
    'getUserImage': getUserImage,
    'setUserImage': setUserImage,
    'setUserPassword': setUserPassword,
    'hasContactInfo': hasContactInfo,
    'setContactInfo': setContactInfo,
    'getNavInfo': getNavInfo,
    'newVerifyId': newVerifyId,
    'checkVerifyId': checkVerifyId,
    'setVerified': setVerified,
    'deleteVerifyId': deleteVerifyId,
    'pruneUnverified': pruneUnverified,
    'newSessionId': newSessionId,
    'deleteSession': deleteSession,
    'validLogin': validLogin,
    'register': register,
    'newPasswordResetId': newPasswordResetId,
    'checkPasswordResetId': checkPasswordResetId,
    'deletePasswordResetId': deletePasswordResetId,
    'resetPassword': resetPassword,
    'passwordResetExists': passwordResetExists,
    'newBookId': newBookId,
    'newBook': newBook,
    'validBook': validBook,
    'getBookInfo': getBookInfo,
    'getUserBookInfo': getUserBookInfo,
    'getNumBooks': getNumBooks,
    'deleteBook': deleteBook,
    'searchBooks': searchBooks,
    'bookLister': bookLister,
    'reportBook': reportBook,
    'userReportedBook': userReportedBook,
    'userReportedRecently': userReportedRecently,
    'numBookReports': numBookReports,
    'getDepartments': getDepartments,
    'getDepartmentName': getDepartmentName,
    'validDepartment': validDepartment,
    'getConditions': getConditions,
    'getConditionName': getConditionName,
    'validCondition': validCondition,
    'canProvideFeedback': canProvideFeedback,
    'updateFeedbackTimestamp': updateFeedbackTimestamp,
    'mainDB': mainDB
};
