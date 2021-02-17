import got from "got";
import * as cheerio from "cheerio";

// Academics page
const departmentsURL = "https://www.luther.edu/academics/";

// Log an error that occurred while scraping departments
function logScrapeDepartmentsError(err: Error) {
  console.log("SCRAPE DEPARTMENTS ERROR");
  console.log("Error:", err.message);
}

// Get a list of the departments
export default function scrapeDepartments(
  callback?: (err: Error, departments: string[]) => void,
  url: string = departmentsURL
) {
  got(url)
    .then((res) => {
      const $ = cheerio.load(res.body);
      var departments = [];
      $("table tbody tr td strong a").each((index, element) => {
        departments.push($(element).children[0].data);
      });
      $("table tbody tr td a strong").each((index, element) => {
        departments.push($(element).children[0].data);
      });
      if (callback) callback(null, departments);
    })
    .catch((err) => {
      logScrapeDepartmentsError(err);
      if (callback) callback(err, null);
    });
}
