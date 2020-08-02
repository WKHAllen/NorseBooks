import * as express    from 'express';
import * as enforce    from 'express-sslify';
import * as hbs        from 'express-handlebars';
import * as session    from 'express-session';
import * as bodyParser from 'body-parser';
import * as routes     from './routes';
import { renderPage, Request, Response } from './routes/util';

const debug         = Boolean(Number(process.env.DEBUG));
const port          = Number(process.env.PORT);
const sessionSecret = process.env.SESSION_SECRET;

// The app object
var app = express();

// Disable caching for authentication purposes
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Enforce HTTPS
if (!debug)
    app.use(enforce.HTTPS({ trustProtoHeader: true }));

// Use view engine
app.engine('.html', hbs({
    extname:       '.html',
    defaultLayout: 'default'
}));
app.set('view engine', '.html');

// Request body parsing
app.use(bodyParser.urlencoded({ extended: true }));

// Track sessions
app.use(session({
    secret:            sessionSecret,
    resave:            false,
    saveUninitialized: false
}));

// Include static directory for css and js files
app.use(express.static('static'));

// Use routes
app.use('/',                     routes.indexRoute);
app.use('/about',                routes.aboutRoute);
app.use('/admin',                routes.adminRoute);
app.use('/book',                 routes.bookRoute);
app.use('/bookSold',             routes.bookSoldRoute);
app.use('/contact',              routes.contactRoute);
app.use('/deleteBook',           routes.deleteBookRoute);
app.use('/edit',                 routes.editRoute);
app.use('/feedback',             routes.feedbackRoute);
app.use('/getAlert',             routes.getAlertRoute);
app.use('/getBooks',             routes.getBooksRoute);
app.use('/help-out',             routes.helpOutRoute);
app.use('/login',                routes.loginRoute);
app.use('/logout',               routes.logoutRoute);
app.use('/password-reset',       routes.passwordResetRoute);
app.use('/profile',              routes.profileRoute);
app.use('/register',             routes.registerRoute);
app.use('/register-success',     routes.registerSuccessRoute);
app.use('/reports',              routes.reportBookRoute);
app.use('/terms-and-conditions', routes.termsAndConditionsRoute);
app.use('/verify',               routes.verifyRoute);

// Error 404 (not found)
app.use((req: Request, res: Response) => {
    renderPage(req, res, '404', { title: 'Not found' });
});

// Error 500 (internal server error)
app.use((req: Request, res: Response) => {
    renderPage(req, res, '500', { title: 'Internal server error' });
});

// Listen for connections
app.listen(port, () => {
    console.log(`App running on port ${port}`);
});

export = app;
