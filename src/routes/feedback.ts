import { Router } from "express";
import { renderPage, Request, Response, auth, stripWhitespace } from "./util";
import * as services from "../services";
import * as emailer from "../emailer";

export var router = Router();

// Feedback form
router.get("/", auth, (req: Request, res: Response) => {
  services.AuthService.getAuthUser(
    (req.session as any).sessionId,
    (userId) => {
      services.FeedbackService.canProvideFeedback(userId, (can) => {
        renderPage(req, res, "feedback", {
          title: "Provide Feedback",
          canProvideFeedback: can,
        });
      });
    }
  );
});

// Feedback provided
router.post("/", auth, (req: Request, res: Response) => {
  services.AuthService.getAuthUser(
    (req.session as any).sessionId,
    (userId, firstname, lastname) => {
      services.FeedbackService.canProvideFeedback(userId, (can) => {
        if (can) {
          var feedback = stripWhitespace(req.body.feedback);
          while (feedback.includes("\n"))
            feedback = feedback.replace("\n", "<br>");
          emailer.sendEmail(
            emailer.emailAddress,
            "User Feedback",
            `${firstname} ${lastname} provided the following feedback:<br><br>${feedback}<br><br>Sincerely,<br>The NorseBooks Dev Team`
          );
          services.FeedbackService.updateFeedbackTimestamp(userId);
        }
        res.redirect("/");
      });
    }
  );
});
