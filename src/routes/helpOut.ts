import { Router } from 'express';
import { renderPage, Request, Response } from './util';

export var router = Router();

// Help out page
router.get('/', (req: Request, res: Response) => {
    renderPage(req, res, 'help-out', { title: 'Help out' });
});
