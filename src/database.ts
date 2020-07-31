import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as db from './db';

const debug = Boolean(Number(process.env.DEBUG));
const dbURL = process.env.DATABASE_URL;
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

// The database object
var mainDB = new db.DB(dbURL, !debug, maxDBClients);

// Callback types
type voidCallback   = () => void;
type boolCallback   = (value: boolean) => void;
type numberCallback = (value: number) => void;
type rowCallback    = (row: any) => void;
type rowsCallback   = (rows: any[]) => void;

// Get the current time to the second
function getTime(): number {
    return Math.floor(new Date().getTime() / 1000);
}

// Check if a table is empty
function tableEmpty(tableName: string, callback?: boolCallback) {
    var sql = `SELECT id FROM ${tableName};`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows.length === 0);
    });
}

// Get the path to a static table
function getStaticTablePath(tableName: string): string {
    return path.join(__dirname, staticTablePath, tableName) + '.csv';
}

// Populate the static tables in the database
function populateStaticTable(tableName: string) {
    tableEmpty(tableName, (empty) => {
        if (empty) {
            fs.createReadStream(getStaticTablePath(tableName))
                .pipe(csv.parse({ headers: true }))
                .on('data', (row) => {
                    // keys
                    var keys = Object.keys(row);
                    var colKeys = keys.join(', ');
                    // values
                    var values = Object.values(row);
                    var colValues = [];
                    for (var i = 0; i < values.length; i++) colValues.push('?');
                    var colValuesArray = colValues.join(', ');
                    // sql
                    var sql = `INSERT INTO ${tableName} (${colKeys}) VALUES (${colValuesArray});`;
                    mainDB.execute(sql, values);
                });
        }
    });
}

// Generate a new hex id
function newHexId(callback?: (hexId: string) => void, length?: number) {
    length = length !== undefined ? length : hexLength;
    crypto.randomBytes(Math.floor(length / 2), (err, buffer) => {
        if (err) throw err;
        if (callback) callback(buffer.toString('hex'));
    });
}

// Generate a new base64 id
function newBase64Id(callback?: (base64Id: string) => void, length?: number) {
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
            contactPlatformId INT,
            contactInfo TEXT,
            joinTimestamp INT NOT NULL,
            lastLogin INT,
            itemsListed INT NOT NULL,
            itemsSold INT NOT NULL,
            moneyMade NUMERIC(8,2) NOT NULL,
            verified INT NOT NULL,
            lastFeedbackTimestamp INT,
            admin INT NOT NULL
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
    var platformTable = `
        CREATE TABLE IF NOT EXISTS Platform (
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
            imageUrl TEXT,
            ISBN10 VARCHAR(10),
            ISBN13 VARCHAR(13)
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
    var searchSortTable = `
        CREATE TABLE IF NOT EXISTS SearchSort (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            query TEXT NOT NULL
        );
    `;
    var metaTable = `
        CREATE TABLE IF NOT EXISTS Meta (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL,
            value TEXT
        );
    `;
    mainDB.executeMany([userTable, departmentTable, conditionTable, platformTable, bookTable, passwordResetTable, verifyTable, sessionTable, reportTable, searchSortTable, metaTable], null, () => {
        // Crash occurs unless wait
        setTimeout(() => {
            // Populate static tables
            populateStaticTable('Department');
            populateStaticTable('Condition');
            populateStaticTable('Platform');
            populateStaticTable('SearchSort');
            // Remove expired password resets
            var timeRemaining: number;
            var sql = `SELECT resetId, createTimestamp FROM PasswordReset;`;
            mainDB.execute(sql, [], (rows) => {
                for (var row of rows) {
                    timeRemaining = row.createtimestamp + Math.floor(passwordResetTimeout / 1000) - getTime();
                    setTimeout(deletePasswordResetId, timeRemaining * 1000, row.resetid);
                }
            });
            // Remove expired verification entries
            var sql = `SELECT verifyId, createTimestamp FROM Verify;`;
            mainDB.execute(sql, [], (rows) => {
                for (var row of rows) {
                    timeRemaining = row.createtimestamp + Math.floor(verifyTimeout / 1000) - getTime();
                    setTimeout(pruneUnverified, timeRemaining * 1000, row.verifyid);
                }
            });
            // Prune old sessions
            var sql = `SELECT id, createTimestamp FROM Session;`;
            mainDB.execute(sql, [], (rows) => {
                for (var row of rows) {
                    timeRemaining = row.createtimestamp + Math.floor(sessionTimeout / 1000) - getTime();
                    setTimeout(deleteSession, timeRemaining * 1000, row.id);
                }
            });
        }, 1000);
    });
}

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
export function getUserImage(userId: number, callback?: (imageUrl: string) => void) {
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

// Get the info necessary for rendering the navbar
export function getNavInfo(sessionId: string, callback?: rowCallback) {
    var sql = `
        SELECT id, imageUrl, firstname, admin FROM NBUser WHERE id = (
            SELECT userId FROM Session WHERE id = ?
        );`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Create a new email verification ID
export function newVerifyId(email: string, callback?: (verifyId: string) => void) {
    email = email.toLowerCase();
    var sql = `DELETE FROM Verify WHERE email = ?;`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        newHexId((verifyId) => {
            var sql = `SELECT id FROM Verify WHERE verifyId = ?;`;
            var params = [verifyId];
            mainDB.execute(sql, params, (rows) => {
                if (rows.length > 0) {
                    newVerifyId(email, callback);
                } else {
                    var sql = `INSERT INTO Verify (email, verifyId, createTimestamp) VALUES (?, ?, ?);`;
                    var params = [email, verifyId, getTime()];
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
export function checkVerifyId(verifyId: string, callback?: boolCallback) {
    var sql = `SELECT verifyId FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Mark a user as verified
export function setVerified(verifyId: string, callback?: voidCallback) {
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
export function deleteVerifyId(verifyId: string, callback?: voidCallback) {
    var sql = `DELETE FROM Verify WHERE verifyId = ?;`;
    var params = [verifyId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
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
        deleteVerifyId(verifyId);
        if (callback) callback();
    });
}

// Create a new session ID
export function newSessionId(email: string, callback?: (sessionId: string) => void) {
    email = email.toLowerCase();
    var sql = `
        DELETE FROM Session WHERE userId = (
            SELECT id FROM NBUser WHERE email = ?
        );`;
    var params = [email];
    mainDB.execute(sql, params, (rows) => {
        newHexId((sessionId) => {
            var sql = `SELECT id FROM Session WHERE id = ?;`;
            var params = [sessionId];
            mainDB.execute(sql, params, (rows) => {
                if (rows.length > 0) {
                    newSessionId(email, callback);
                } else {
                    var sql = `
                        INSERT INTO Session (id, userId, createTimestamp) VALUES (
                            ?,
                            (SELECT id FROM NBUser WHERE email = ?),
                            ?
                        );`;
                    var params = [sessionId, email, getTime()];
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
export function deleteSession(sessionId: string, callback?: voidCallback) {
    var sql = `DELETE FROM Session WHERE id = ?;`;
    var params = [sessionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

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
                    newSessionId(email, (sessionId) => {
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
        var sql = `
            INSERT INTO NBUser (email, password, firstname, lastname, joinTimestamp, itemsListed, itemsSold, moneyMade, verified, admin) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            );`;
        var params = [email, hash, firstname, lastname, getTime(), 0, 0, 0, 0, 0];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    });
}

// Generate a new password reset ID
export function newPasswordResetId(email: string, callback?: (resetId: string) => void) {
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

// Check if a password reset ID is valid
export function checkPasswordResetId(passwordResetId: string, callback?: boolCallback) {
    var sql = `SELECT resetId FROM PasswordReset WHERE resetId = ?;`;
    var params = [passwordResetId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
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

// Reset a password
export function resetPassword(passwordResetId: string, newPassword: string, callback?: boolCallback) {
    var sql = `
        SELECT id FROM NBUser WHERE email = (
            SELECT email FROM PasswordReset WHERE resetId = ?
        );`;
    var params = [passwordResetId];
    mainDB.execute(sql, params, (rows) => {
        if (rows.length === 1) {
            setUserPassword(rows[0].id, newPassword);
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

// Create a new book id
export function newBookId(callback?: (bookId: string) => void, length?: number) {
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
export function newBook(title: string, author: string, departmentId: number, courseNumber: number, conditionId: number, description: string, userId: number, price: number, imageUrl: string, ISBN10: string, ISBN13: string, callback?: (bookId: string) => void) {
    newBookId((bookId) => {
        var sql = `
            INSERT INTO Book (
                bookId, title, author, departmentId, courseNumber, conditionId, description, userId, price, listedTimestamp, imageUrl, ISBN10, ISBN13
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
        var params = [bookId, title, author, departmentId, courseNumber, conditionId, description, userId, price, getTime(), imageUrl, ISBN10, ISBN13];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback(bookId);
            var sql = `UPDATE NBUser SET itemsListed = itemsListed + 1 WHERE id = ?;`;
            var params = [userId];
            mainDB.execute(sql, params);
        });
    });
}

// Edit an existing book
export function editBook(bookId: string, title: string, author: string, departmentId: number, courseNumber: number, conditionId: number, description: string, userId: number, price: number, imageUrl: string, ISBN10: string, ISBN13: string, callback?: voidCallback) {
    var params = [title, author, departmentId, courseNumber, conditionId, description, price, ISBN10, ISBN13];
    var image = '';
    if (imageUrl !== null) {
        image = ', imageUrl = ?';
        params.push(imageUrl);
    }
    params.push(bookId, userId);
    var sql = `
        UPDATE Book
            SET title = ?, author = ?, departmentId = ?, courseNumber = ?, conditionId = ?,
            description = ?, price = ?, ISBN10 = ?, ISBN13 = ?${image}
        WHERE bookId = ? AND userId = ?;`;
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Check if a book is valid
export function validBook(bookId: string, callback?: boolCallback) {
    var sql = `SELECT id FROM Book WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Get information on a book
export function getBookInfo(bookId: string, callback?: rowCallback) {
    var sql = `SELECT id, title, author, departmentId, courseNumber, conditionId, description, price, imageUrl, ISBN10, ISBN13 FROM Book WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Get information on the user who listed a book
export function getUserBookInfo(bookId: string, callback?: rowCallback) {
    var sql = `
        SELECT id, firstname, lastname, contactPlatformId, contactInfo FROM NBUser WHERE id = (
            SELECT userId FROM Book WHERE bookId = ?
        );`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0]);
    });
}

// Get the number of departments
export function getNumUserBooks(userId: number, callback?: numberCallback) {
    var sql = `SELECT id FROM Book WHERE userId = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length);
    });
}

// Delete a book
export function deleteBook(userId: number, bookId: string, callback?: voidCallback) {
    var sql = `DELETE FROM Book WHERE id = ? AND userId = ?;`;
    var params = [bookId, userId];
    mainDB.execute(sql, params, (rows) => {
        var sql = `DELETE FROM Report WHERE bookId = ?;`;
        var params = [bookId];
        mainDB.execute(sql, params, (rows) => {
            if (callback) callback();
        });
    });
}

// Delete a book and mark it as sold
export function bookSold(userId: number, bookId: string, callback?: voidCallback) {
    var sql = `UPDATE NBUser SET itemsSold = itemsSold + 1 WHERE id = ?;`;
    var params = [userId];
    mainDB.execute(sql, params, (rows) => {
        var sql = `
            UPDATE NBUser SET moneyMade = moneyMade + (
                SELECT price FROM Book WHERE id = ?
            ) WHERE id = ?;`;
        var params = [bookId, userId];
        mainDB.execute(sql, params, (rows) => {
            deleteBook(userId, bookId, () => {
                if (callback) callback();
            });
        });
    });
}

// Get info on books searched
export function searchBooks(options: object, sort: number, lastBookId: string, callback?: rowsCallback) {
    var params = [];
    var extraParams = [];
    var searchQuery = '';
    if (Object.keys(options).length > 0) {
        var searchOptions = [];
        for (var option in options) {
            if (option === 'title' || option === 'author') {
                searchOptions.push(` LOWER(${option}) LIKE LOWER(?)`);
                params.push(`%${options[option]}%`);
                if (lastBookId) extraParams.push(`%${options[option]}%`);
            } else if (option === 'ISBN') {
                searchOptions.push(' (ISBN10 = ? OR ISBN13 = ?)');
                params.push(options[option], options[option]);
                if (lastBookId) {
                    extraParams.push(options[option], options[option]);
                }
            } else {
                searchOptions.push(` ${option} = ?`);
                params.push(options[option]);
                if (lastBookId) extraParams.push(options[option]);
            }
        }
        for (var extraParam of extraParams) params.push(extraParam);
        searchQuery = ' WHERE' + searchOptions.join(' AND');
    }
    getSearchSortQuery(sort, (sortQuery) => {
        getMeta('Books per query', (booksPerQuery) => {
            var numBooksPerQuery = parseInt(booksPerQuery);
            sortQuery = sortQuery || 'listedTimestamp DESC';
            if (lastBookId) {
                var sql = `
                    SELECT * FROM (
                        SELECT
                            bookId, title, author, departmentId, Department.name AS department, courseNumber,
                            price, conditionId, imageUrl, ISBN10, ISBN13,
                            ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                        FROM Book
                        JOIN Department ON Book.departmentId = Department.id
                        ${searchQuery}
                    ) search1 WHERE index > (
                        SELECT index FROM (
                            SELECT
                                bookId, title, author, departmentId, Department.name AS department, courseNumber,
                                price, conditionId, imageUrl, ISBN10, ISBN13,
                                ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                            FROM Book
                            JOIN Department ON Book.departmentId = Department.id
                            ${searchQuery}
                        ) search2 WHERE bookId = ?
                    ) LIMIT ?;`;
                params.push(lastBookId, numBooksPerQuery);
            } else {
                var sql = `
                    SELECT
                        bookId, title, author, departmentId, Department.name AS department, courseNumber,
                        price, conditionId, imageUrl, ISBN10, ISBN13,
                        ROW_NUMBER () OVER (ORDER BY ${sortQuery}) AS index
                    FROM Book
                    JOIN Department ON Book.departmentId = Department.id
                    ${searchQuery} LIMIT ?;`;
                params.push(numBooksPerQuery);
            }
            mainDB.execute(sql, params, (rows) => {
                if (callback) callback(rows);
            });
        });
    });
}

// Get the id of the person who listed a book
export function bookLister(bookId: string, callback?: numberCallback) {
    var sql = `SELECT userId FROM Book WHERE id = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].userid);
    });
}

// Report a book
export function reportBook(userId: number, bookId: string, callback?: boolCallback) {
    var sql = `INSERT INTO Report (bookId, userId, reportTimestamp) VALUES (?, ?, ?);`;
    var params = [bookId, userId, getTime()];
    mainDB.execute(sql, params, (rows) => {
        numBookReports(bookId, (reports) => {
            bookLister(bookId, (listerId) => {
                getMeta('Max reports', (maxReports) => {
                    var numMaxReports = parseInt(maxReports);
                    if (reports >= numMaxReports) {
                        deleteBook(listerId, bookId);
                        if (callback) callback(true);
                    } else {
                        if (callback) callback(false);
                    }
                });
            });
        });
    });
}

// Check if a user has already reported a book
export function userReportedBook(userId: number, bookId: string, callback?: boolCallback) {
    var sql = `SELECT id FROM Report WHERE bookId = ? AND userId = ?;`;
    var params = [bookId, userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Check if a user has reported a book recently
export function userReportedRecently(userId: number, callback?: boolCallback) {
    var sql = `SELECT id FROM Report WHERE userId = ? AND reportTimestamp > ?;`;
    var params = [userId, getTime() - Math.floor(reportTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length > 0);
    });
}

// Get the number of reports on a book
export function numBookReports(bookId: string, callback?: numberCallback) {
    var sql = `SELECT id FROM Report WHERE bookId = ?;`;
    var params = [bookId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length);
    });
}

// Get all departments
export function getDepartments(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM Department ORDER BY name;`;
    mainDB.execute(sql, [], (rows) => {
        rows.push({ id: -1, name: 'Other' });
        if (callback) callback(rows);
    });
}

// Get the name of a department by ID
export function getDepartmentName(departmentId: number, callback?: (departmentName: string) => void) {
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
export function validDepartment(departmentId: number, callback?: boolCallback) {
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
export function getConditions(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM Condition ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get the name of a condition by ID
export function getConditionName(conditionId: number, callback?: (conditionName: string) => void) {
    var sql = `SELECT name FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].name);
    });
}

// Check if a book condition is valid
export function validCondition(conditionId: number, callback?: boolCallback) {
    var sql = `SELECT id FROM Condition WHERE id = ?;`;
    var params = [conditionId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Get all available contact platforms
export function getPlatforms(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM Platform ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get the name of a contact platform by ID
export function getPlatformName(platformId: number, callback?: (platformName: string) => void) {
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

// Get all available search sorting options
export function getSearchSortOptions(callback?: rowsCallback) {
    var sql = `SELECT id, name FROM SearchSort ORDER BY id;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get the name of a search sorting option by ID
export function getSearchSortName(searchSortId: number, callback?: (searchSortName: string) => void) {
    var sql = `SELECT name FROM SearchSort WHERE id = ?;`;
    var params = [searchSortId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].name);
    });
}

// Get the ORDER BY section of a search query by ID
export function getSearchSortQuery(searchSortId: number, callback?: (searchSortQuery: string) => void) {
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

// Check if a user can provide feedback
export function canProvideFeedback(userId: number, callback?: boolCallback) {
    var sql = `SELECT id FROM NBUser WHERE id = ? AND (lastFeedbackTimestamp < ? OR lastFeedbackTimestamp IS NULL);`;
    var params = [userId, getTime() - Math.floor(feedbackTimeout / 1000)];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows.length === 1);
    });
}

// Update a user's feedback timestamp to the current time
export function updateFeedbackTimestamp(userId: number, callback?: voidCallback) {
    var sql = `UPDATE NBUser SET lastFeedbackTimestamp = ? WHERE id = ?;`;
    var params = [getTime(), userId];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
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

// Get the value of a variable in the Meta table
export function getMeta(key: string, callback?: (value: string) => void) {
    var sql = `SELECT value FROM Meta WHERE key = ?;`;
    var params = [key];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback(rows[0].value);
    });
}

// Set the value of a variable in the Meta table
export function setMeta(key: string, value: any, callback?: voidCallback) {
    var sql = `UPDATE Meta SET value = ? WHERE key = ?;`;
    var params = [value, key];
    mainDB.execute(sql, params, (rows) => {
        if (callback) callback();
    });
}

// Get the number of users registered
export function getNumUsers(callback?: numberCallback) {
    var sql = `SELECT COUNT(id) FROM NBUser WHERE verified = 1;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].count);
    });
}

// Get the number of books on the site
export function getNumBooks(callback?: numberCallback) {
    var sql = `SELECT COUNT(id) FROM Book;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].count);
    });
}

// Get the number of books sold
export function getNumSold(callback?: numberCallback) {
    var sql = `SELECT SUM(itemsSold) FROM NBUser;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].sum);
    });
}

// Get the total number of books that have been listed on the site
export function getTotalListed(callback?: numberCallback) {
    var sql = `SELECT SUM(itemsListed) FROM NBUser;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].sum);
    });
}

// Get the total amount of money made using the site
export function getTotalMoneyMade(callback?: numberCallback) {
    var sql = `SELECT SUM(moneyMade) FROM NBUser;`
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].sum);
    });
}

// Get the number of tables in the database
export function getNumTables(callback?: numberCallback) {
    var sql = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].count);
    });
}

// Get the names of the tables in the database
export function getTables(callback?: (tables: string[]) => void) {
    var sql = `SELECT table_name AS table FROM information_schema.tables WHERE table_schema = 'public';`;
    mainDB.execute(sql, [], (rows) => {
        var tables = [];
        for (var row of rows) tables.push(row.table);
        if (callback) callback(tables);
    });
}

// Get the names of the columns in a table
export function getColumns(table: string, callback?: (columns: string[]) => void) {
    var sql = `SELECT column_name AS column FROM information_schema.columns WHERE table_name = '${table.toLowerCase()}';`;
    mainDB.execute(sql, [], (rows) => {
        var columns = [];
        for (var row of rows) columns.push(row.column);
        if (callback) callback(columns);
    });
}

// Get the number of rows in each table in the database
export function getRowCount(callback?: rowsCallback) {
    var sql = `
        SELECT
            table_name AS table,
            (xpath('/row/cnt/text()', xml_count))[1]::TEXT::INT as rows
        FROM (
            SELECT
                table_name, table_schema,
                query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
            FROM information_schema.tables
            WHERE table_schema = 'public'
        ) t;
    `;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get the total number of rows currently used by the database
export function getNumRows(callback?: numberCallback) {
    var sql = `
        SELECT SUM(rows) FROM (
            SELECT
                table_name AS table,
                (xpath('/row/cnt/text()', xml_count))[1]::TEXT::INT as rows
            FROM (
                SELECT
                    table_name, table_schema,
                    query_to_xml(format('SELECT COUNT(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
                FROM information_schema.tables
                WHERE table_schema = 'public'
            ) t
        ) AS subq;
    `;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].sum);
    });
}

// Get the number of reports
export function getNumReports(callback?: numberCallback) {
    var sql = `SELECT COUNT(id) FROM Report;`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows[0].count);
    });
}

// Get all reports
export function getReports(callback?: rowsCallback) {
    var sql = `
        SELECT
            NBUser.firstname AS firstname,
            NBUser.lastname AS lastname,
            Book.bookId AS bookId,
            Book.title AS title,
            reportTimestamp
        FROM Report
        JOIN NBUser ON Report.userId = NBUser.id
        JOIN Book ON Report.bookId = Book.id
        ORDER BY Book.id, reportTimestamp;
    `;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Execute a query
export function executeSelect(queryInputs: any, callback?: rowsCallback) {
    var select = 'SELECT';
    if (queryInputs.columns) {
        var select = 'SELECT ' + queryInputs.columns.join(', ');
    }
    var from = `FROM ${queryInputs.table}`;
    var where = '';
    if (queryInputs.where && queryInputs.whereOperator && queryInputs.whereValue) {
        where = `WHERE ${queryInputs.where} ${queryInputs.whereOperator} '${queryInputs.whereValue}'`;
    }
    var orderBy = '';
    if (queryInputs.orderBy && queryInputs.orderByDirection) {
        orderBy = `ORDER BY ${queryInputs.orderBy} ${queryInputs.orderByDirection}`;
    }
    var query = [select, from, where, orderBy].join(' ') + ';';
    while (query.includes('  ')) query = query.replace('  ', ' ');
    mainDB.execute(query, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Get relevant information on all users
export function getUsers(orderBy: string, orderDirection: string, callback?: rowsCallback) {
    var sql = `
        SELECT
            firstname, lastname, email, joinTimestamp,
            itemsListed, itemsSold, moneyMade
        FROM NBUser
        WHERE verified = 1
        ORDER BY ${orderBy} ${orderDirection};
    `;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows);
    });
}

// Initialize the database on import
init();
