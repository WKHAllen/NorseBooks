import { Router } from "express";
import {
  renderPage,
  Request,
  Response,
  stripWhitespace,
  getHostname,
  newRandomPassword,
  sendPasswordResetEmail,
} from "./util";
import * as services from "../services";
import * as owasp from "owasp-password-strength-test";

export var router = Router();

// Request password reset page
router.get("/", (req: Request, res: Response) => {
  renderPage(req, res, "password-reset-request", {
    title: "Password reset request",
  });
});

// Request password reset event
router.post("/", (req: Request, res: Response) => {
  var email = stripWhitespace(req.body.email).replace("@luther.edu", "");
  renderPage(req, res, "password-reset-request-success", {
    title: "Password reset request",
  });
  services.PasswordResetService.passwordResetExists(email, (exists) => {
    if (!exists) {
      sendPasswordResetEmail(email, getHostname(req));
    }
  });
});

// Password reset page
router.get("/:passwordResetId", (req: Request, res: Response) => {
  services.PasswordResetService.checkPasswordResetId(
    req.params.passwordResetId,
    (valid) => {
      renderPage(req, res, "password-reset", {
        title: "Reset password",
        valid: valid,
        passwordExample: newRandomPassword(),
      });
    }
  );
});

// Password reset event
router.post("/:passwordResetId", (req: Request, res: Response) => {
  if (req.body.newPassword === req.body.confirmNewPassword) {
    var result = owasp.test(req.body.newPassword);
    if (result.errors.length === 0) {
      services.PasswordResetService.resetPassword(
        req.params.passwordResetId,
        req.body.newPassword
      );
      renderPage(req, res, "password-reset-success", {
        title: "Password reset success",
      });
    } else {
      renderPage(req, res, "password-reset", {
        title: "Reset password",
        valid: true,
        passwordExample: newRandomPassword(),
        error: result.errors.join("\n"),
      });
    }
  } else {
    renderPage(req, res, "password-reset", {
      title: "Reset password",
      valid: true,
      passwordExample: newRandomPassword(),
      error: "Passwords do not match",
    });
  }
});
