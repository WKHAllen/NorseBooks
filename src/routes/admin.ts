import { Router } from 'express';
import { renderPage, Request, Response, adminAuth, formatPrice } from './util';
import * as services from '../services';

export var router = Router();

// Admin main page
router.get('/', adminAuth, (req: Request, res: Response) => {
    services.MetaService.getMeta('Max books', (maxBooks) => {
        services.MetaService.getMeta('Max reports', (maxReports) => {
            services.MetaService.getMeta('Books per query', (booksPerQuery) => {
                services.MetaService.getMeta('Version', (version) => {
                    renderPage(req, res, 'admin', {
                        title: 'Admin',
                        maxBooks: parseInt(maxBooks),
                        maxReports: parseInt(maxReports),
                        booksPerQuery: parseInt(booksPerQuery),
                        version: version
                    });
                });
            });
        });
    });
});

// Get admin page stats
router.get('/getAdminStats', adminAuth, (req: Request, res: Response) => {
    services.StatsService.getNumUsers((numUsers) => {
        services.StatsService.getNumBooks((numBooks) => {
            services.StatsService.getNumSold((numSold) => {
                services.StatsService.getTotalListed((totalListed) => {
                    services.StatsService.getTotalMoneyMade((totalMoneyMade) => {
                        services.StatsService.getNumTables((numTables) => {
                            services.StatsService.getNumRows((numRows) => {
                                services.StatsService.getNumReports((numReports) => {
                                    var rowsPercentage = Math.floor(numRows / 10000 * 100 * 10) / 10;
                                    res.json({
                                        numUsers: numUsers,
                                        numBooks: numBooks,
                                        numSold: numSold,
                                        totalListed: totalListed,
                                        totalMoneyMade: formatPrice(totalMoneyMade),
                                        numTables: numTables,
                                        numRows: numRows,
                                        rowsPercentage: rowsPercentage,
                                        numReports: numReports
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

// Edit version event
router.post('/setVersion', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Version', req.body.version, () => {
        res.redirect('/admin');
    });
});

// Edit max books event
router.post('/setMaxBooks', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Max books', req.body.maxBooks, () => {
        res.redirect('/admin');
    });
});

// Edit max reports event
router.post('/setMaxReports', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Max reports', req.body.maxReports, () => {
        res.redirect('/admin');
    });
});

// Edit books per query event
router.post('/setBooksPerQuery', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Books per query', req.body.booksPerQuery, () => {
        res.redirect('/admin');
    });
});

// Edit terms and conditions page
router.get('/terms-and-conditions', adminAuth, (req: Request, res: Response) => {
    services.MetaService.getMeta('Terms and Conditions', (termsAndConditions) => {
        renderPage(req, res, 'admin-tac', { title: 'Edit terms and conditions', termsAndConditions: termsAndConditions });
    });
});

// Edit terms and conditions event
router.post('/terms-and-conditions', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Terms and Conditions', req.body.tac, () => {
        res.redirect('/admin/terms-and-conditions');
    });
});

// Pseudo-query page
router.get('/query', adminAuth, (req: Request, res: Response) => {
    renderPage(req, res, 'admin-query', { title: 'Query' });
});

// Get the database tables
router.get('/getDBTables', adminAuth, (req: Request, res: Response) => {
    services.AdminService.getTables((tables) => {
        res.json({ tables: tables });
    });
});

// Get the columns of a single table in the database
router.get('/getDBColumns', adminAuth, (req: Request, res: Response) => {
    services.AdminService.getColumns(req.query.table as string, (columns) => {
        res.json({ columns: columns });
    })
});

// Execute a select statement on the database
router.get('/executeSelect', adminAuth, (req: Request, res: Response) => {
    services.AdminService.executeSelect(req.query.queryInputs, (rows) => {
        res.json({ result: rows });
    });
});

// View reports page
router.get('/reports', adminAuth, (req: Request, res: Response) => {
    services.AdminService.getReports((reports) => {
        renderPage(req, res, 'admin-reports', { reports: reports });
    });
});

// Site alert page
router.get('/alert', adminAuth, (req: Request, res: Response) => {
    services.MetaService.getMeta('Alert', (alertValue) => {
        services.MetaService.getMeta('Alert timeout', (alertTimeout) => {
            if (alertValue !== null && alertTimeout !== null) {
                var remaining = Math.floor(parseInt(alertTimeout) - (new Date().getTime() / 1000));
                if (remaining > 0) {
                    var days = Math.floor(remaining / (60 * 60 * 24));
                    var hours = Math.floor((remaining - (days * 60 * 60 * 24)) / (60 * 60));
                    var minutes = Math.floor((remaining - (days * 60 * 60 * 24) - (hours * 60 * 60)) / 60);
                    var seconds = remaining - (days * 60 * 60 * 24) - (hours * 60 * 60) - (minutes * 60);
                    renderPage(req, res, 'admin-alert', {
                        alertValue: alertValue,
                        days: days,
                        hours: hours,
                        minutes: minutes,
                        seconds: seconds,
                        alertTimeout: alertTimeout,
                        error: req.session.errorMsg || undefined
                    });
                } else {
                    renderPage(req, res, 'admin-alert', { error: req.session.errorMsg || undefined });
                }
            } else {
                renderPage(req, res, 'admin-alert', { error: req.session.errorMsg || undefined });
            }
            req.session.errorMsg = undefined;
        });
    });
});

// Set alert event
router.post('/alert', adminAuth, (req: Request, res: Response) => {
    var days = parseInt(req.body.days);
    var hours = parseInt(req.body.hours);
    var minutes = parseInt(req.body.minutes);
    var seconds = parseInt(req.body.seconds);
    if (isNaN(days) || isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        req.session.errorMsg = 'Days, hours, minutes, and seconds must all be integers';
        res.redirect('/admin/alert');
    } else {
        if (hours < 0 || hours >= 24) {
            req.session.errorMsg = 'Hours must be between 0 and 23';
            res.redirect('/admin/alert');
        } else if (minutes < 0 || minutes >= 60) {
            req.session.errorMsg = 'Minutes must be between 0 and 59';
            res.redirect('/admin/alert');
        } else if (minutes < 0 || seconds >= 60) {
            req.session.errorMsg = 'Seconds must be between 0 and 59';
            res.redirect('/admin/alert');
        } else {
            var timeout = (days * 60 * 60 * 24) + (hours * 60 * 60) + (minutes * 60) + seconds;
            var timeoutTimestamp = Math.floor(new Date().getTime() / 1000) + timeout;
            services.MetaService.setMeta('Alert', req.body.alertValue, () => {
                services.MetaService.setMeta('Alert timeout', timeoutTimestamp.toString(), () => {
                    res.redirect('/admin/alert');
                });
            });
        }
    }
});

// Remove alert event
router.post('/removeAlert', adminAuth, (req: Request, res: Response) => {
    services.MetaService.setMeta('Alert', null, () => {
        res.redirect('/admin/alert');
    });
});

// Admin users page
router.get('/users', adminAuth, (req: Request, res: Response) => {
    var orderBy = req.query.orderBy as string || 'joinTimestamp';
    var orderDirection = req.query.orderDirection as string || 'ASC';
    services.AdminService.getUsers(orderBy, orderDirection, (users) => {
        renderPage(req, res, 'admin-users', { users: users, orderBy: orderBy, orderDirection: orderDirection });
    });
});

// Admin books page
router.get('/books', adminAuth, (req: Request, res: Response) => {
    var orderBy = req.query.orderBy as string || 'listedTimestamp';
    var orderDirection = req.query.orderDirection as string || 'ASC';
    services.AdminService.getBooks(orderBy, orderDirection, (books) => {
        renderPage(req, res, 'admin-books', { books: books, orderBy: orderBy, orderDirection: orderDirection });
    });
});

// Admin rows page
router.get('/rows', adminAuth, (req: Request, res: Response) => {
    services.AdminService.getRowCount((tables) => {
        renderPage(req, res, 'admin-rows', { tables: tables });
    });
});
