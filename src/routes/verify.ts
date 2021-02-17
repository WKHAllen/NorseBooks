import { Router } from "express";
import { renderPage, Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// Verify email address page
router.get("/:verifyId", (req: Request, res: Response) => {
  services.VerificationService.checkVerifyId(req.params.verifyId, (valid) => {
    renderPage(req, res, "verify", { title: "Verify", valid: valid });
    if (valid) {
      services.VerificationService.setVerified(req.params.verifyId, () => {
        services.VerificationService.deleteVerifyId(req.params.verifyId);
      });
    }
  });
});
