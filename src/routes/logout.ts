import { Router } from "express";
import { Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// Logout event
router.get("/", (req: Request, res: Response) => {
  services.SessionService.deleteSession((req.session as any).sessionId, () => {
    (req.session as any).destroy(() => {
      res.redirect("/login");
    });
  });
});
