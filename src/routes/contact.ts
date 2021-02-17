import { Router } from "express";
import { renderPage, Request, Response } from "./util";

export var router = Router();

// Contact page
router.get("/", (req: Request, res: Response) => {
  renderPage(req, res, "contact", { title: "Contact Us" });
});
