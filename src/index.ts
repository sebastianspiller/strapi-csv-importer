import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { gql } from "@apollo/client";
import createApolloClient from "./apolloClient";
import specialExcelParsing from "./specialExcelParsing";
import dotenv from "dotenv";
import { parse } from "csv-parse";

async function importScript() {
  console.log("Importing CSV file...");

  dotenv.config();

  if (!process.env.STRAPI_EMAIL || !process.env.STRAPI_PASSWORD) {
    throw new Error("STRAPI_EMAIL or STRAPI_PASSWORD not set.");
  }

  const client = await createApolloClient(
    process.env.STRAPI_EMAIL,
    process.env.STRAPI_PASSWORD,
  );

  const csvOptions = {
    // columns: true,
    delimiter: process.env.CSV_DELIMITER,
    quote: process.env.CSV_QUOTE || "",
    escape: process.env.CSV_ESCAPE,
    skipLines: 0,
    headers: true,
    strict: true,
    ignoreEmpty: true,
  };

  // ".." because of the dist folder
  const csvDir = path.join(__dirname, "..", "csv");
  const csvFiles = fs
    .readdirSync(csvDir)
    .filter((file) => file.endsWith(".csv"));

  if (csvFiles.length === 0) {
    throw new Error("No CSV-File found in the directory.");
  }

  if (csvFiles.length > 1) {
    throw new Error("Found more than 1 CSV file in the directory.");
  }

  const csvFilePath = path.join(csvDir, csvFiles[0]);
  let headers: string[] = [];
  let rows = [];

  try {
    rows = await new Promise<string[][]>((resolve, reject) => {
      const rowStream = fs
        .createReadStream(csvFilePath)
        .pipe(specialExcelParsing)
        .pipe(parse(csvOptions));

      const allRows: string[][] = [];
      let isFirstRow = true;
      rowStream.on("data", (row: string[]) => {
        if (isFirstRow) {
          headers = row;
          isFirstRow = false;
          return;
        }
        allRows.push(row);
      });

      rowStream.on("end", () => {
        resolve(allRows);
      });

      rowStream.on("error", (err: Error) => {
        reject(err);
      });
    });

    const collectionName = process.env.COLLECTION_NAME;

    /**
     * Create a json v2 format
       {
            "version": 2, // required for the import to work properly.
            "data": {
                // Each collection has a dedicated key in the `data` property.
                "api::collection-name.collection-name": {
                // Sub keys are `id`s of imported entries and values hold the data of the entries to import.
                "1": {
                    "id": 1
                    "name": "Gly Clean"
                "2": {
                    "id": 2
                    //...
                }
            }
        }
     */
    const jsonData: any = {
      version: 2,
      data: {
        [`api::${collectionName}.${collectionName}`]: {},
      },
    };

    rows.forEach((row, index) => {
      const rowData: any = {};
      headers.forEach((header, headerIndex) => {
        const snake_case_header = camelToSnake(header);
        rowData[snake_case_header] = changeIfRichtext(
          header,
          row[headerIndex].trim(),
        );
      });
      jsonData.data[`api::${collectionName}.${collectionName}`][index + 1] = {
        id: index + 1,
        ...rowData,
        publishedAt: new Date().toISOString(),
      };
    });

    // Save the json data in a json file in out directory:
    const outputDir = path.join(__dirname, "..", "out");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputFilePath = path.join(outputDir, "importData.json");
    fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));

    console.log("Import completed.");
  } catch (error) {
    console.error("Error while importing the CSV file:", error);
  }
}

/**
 * If it's a string, set GraphQL type to String, ...
 * @param header Header (Column) of the CSV file.
 */
function decideHeader(sampleRow: any, header: string) {
  const value = sampleRow[header];
  if (value === "true" || value === "false") {
    return `$${header}: Boolean`;
  } else if (typeof value === "string") {
    return `$${header}: String`;
  } else if (typeof value === "number") {
    return `$${header}: Float`;
  } else {
    throw new Error(`Unsupported data type for header: ${header}`);
  }
}

/**
 * Function: Switch CamelCase to snake_case
 */
function camelToSnake(str: string) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function changeIfRichtext(header: string, value: string) {
  // get header from process.env.RICH_TEXT_FIELDS (comma separated):
  const richTextFields = process.env.RICH_TEXT_FIELDS?.split(",") ?? [];

  if (richTextFields.includes(header)) {
    return [
      {
        type: "paragraph",
        children: [{ type: "text", text: value }],
      },
    ];
  }

  return value;
}

importScript().catch((err) => console.error(err));
