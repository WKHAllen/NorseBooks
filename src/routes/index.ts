import { Router } from "express";
import { renderPage, Request, Response } from "./util";
import * as services from "../services";

export var router = Router();

// Main page
router.get("/", (req: Request, res: Response) => {
  console.log("Request index");
  console.log("Getting departments...");
  services.DepartmentService.getDepartments((departments) => {
    console.log("Getting sort options...");
    services.SearchSortService.getSearchSortOptions((searchSortOptions) => {
      if (
        !req.query.title &&
        !req.query.author &&
        !req.query.department &&
        !req.query.courseNumber &&
        !req.query.ISBN &&
        !req.query.sort
      ) {
        console.log("Rendering index without form");
        renderPage(req, res, "index", {
          departments: departments,
          sortOptions: searchSortOptions,
        });
      } else {
        console.log("Rendering index with form");
        renderPage(req, res, "index", {
          departments: departments,
          sortOptions: searchSortOptions,
          form: {
            title: req.query.title,
            author: req.query.author,
            department: req.query.department,
            courseNumber: req.query.courseNumber,
            ISBN: req.query.ISBN,
            sort: req.query.sort,
          },
        });
      }
    });
  });
});
