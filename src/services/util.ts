import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';
import * as crypto from 'crypto';
import * as db from '../db';
import { MiscService } from './misc';
import { PasswordResetService } from './passwordReset';
import { SessionService } from './session';

export const dbURL = process.env.DATABASE_URL;
export const maxDBClients = 20;
export const saltRounds   = 12;
export const hexLength    = 64;
export const base64Length = 4;

export const passwordResetTimeout = 60 * 60 * 1000; // one hour
export const verifyTimeout        = 60 * 60 * 1000; // one hour
export const reportTimeout        = 60 * 60 * 1000; // one hour
export const sessionTimeout       = 14 * 24 * 60 * 60 * 1000; // two weeks
export const feedbackTimeout      = 7 * 24 * 60 * 60 * 1000; // one week

export const staticTablePath = 'tables';

// The database object
export var mainDB = new db.DB(dbURL, true, maxDBClients);

// Callback types
export type voidCallback   = ()               => void;
export type boolCallback   = (value: boolean) => void;
export type numberCallback = (value: number)  => void;
export type stringCallback = (value: string)  => void;
export type rowCallback    = (row:   any)     => void;
export type rowsCallback   = (rows:  any[])   => void;

// Get the current time to the second
export function getTime(): number {
    return Math.floor(new Date().getTime() / 1000);
}

// Check if a table is empty
export function tableEmpty(tableName: string, callback?: boolCallback) {
    var sql = `SELECT id FROM ${tableName};`;
    mainDB.execute(sql, [], (rows) => {
        if (callback) callback(rows.length === 0);
    });
}

// Get the path to a static table
export function getStaticTablePath(tableName: string): string {
    return path.join(__dirname, staticTablePath, tableName) + '.csv';
}

// Populate the static tables in the database
export function populateStaticTable(tableName: string) {
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
export function newHexId(callback?: stringCallback, length?: number) {
    length = length !== undefined ? length : hexLength;
    crypto.randomBytes(Math.floor(length / 2), (err, buffer) => {
        if (err) throw err;
        if (callback) callback(buffer.toString('hex'));
    });
}

// Generate a new base64 id
export function newBase64Id(callback?: stringCallback, length?: number) {
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
export function init() {
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
                    setTimeout(PasswordResetService.deletePasswordResetId, timeRemaining * 1000, row.resetid);
                }
            });
            // Remove expired verification entries
            var sql = `SELECT verifyId, createTimestamp FROM Verify;`;
            mainDB.execute(sql, [], (rows) => {
                for (var row of rows) {
                    timeRemaining = row.createtimestamp + Math.floor(verifyTimeout / 1000) - getTime();
                    setTimeout(MiscService.pruneUnverified, timeRemaining * 1000, row.verifyid);
                }
            });
            // Prune old sessions
            var sql = `SELECT id, createTimestamp FROM Session;`;
            mainDB.execute(sql, [], (rows) => {
                for (var row of rows) {
                    timeRemaining = row.createtimestamp + Math.floor(sessionTimeout / 1000) - getTime();
                    setTimeout(SessionService.deleteSession, timeRemaining * 1000, row.id);
                }
            });
        }, 1000);
    });
}
