import { Router } from 'express';
import { renderPage, Request, Response } from './util';

export var router = Router();

// After registering
router.get('/', (req: Request, res: Response) => {
    renderPage(req, res, 'register-success', { title: 'Successfully registered' });
});
