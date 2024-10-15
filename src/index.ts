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
    //columns: true,
    delimiter: process.env.CSV_DELIMITER,
    quote: process.env.CSV_QUOTE || "",
    escape: process.env.CSV_ESCAPE,
    skipLines: 0,
    headers: true,
    strict: true,
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

  try {
    const headers = await new Promise<string[]>((resolve, reject) => {
      const headerStream = fs
        .createReadStream(csvFilePath)
        .pipe(specialExcelParsing)
        .pipe(parse({ ...csvOptions, to_line: 1 }));

      headerStream.on("data", (header: string[]) => {
        headerStream.pause();
        resolve(header);
      });
      headerStream.on("error", (err: Error) => {
        headerStream.pause();
        reject(err);
      });
    });

    console.log("headers", headers);

    const sampleRow = await new Promise<string[]>((resolve, reject) => {
      const rowStream = fs
        .createReadStream(csvFilePath)
        .pipe(specialExcelParsing)
        .pipe(parse({ ...csvOptions, to_line: 2, from_line: 2 }));

      rowStream.on("data", (row: string[]) => {
        rowStream.pause();
        resolve(row);
      });

      rowStream.on("error", (err: Error) => {
        rowStream.pause();
        reject(err);
      });
    });

    console.log("sampleRow", sampleRow);

    const mutationFields = headers
      .map(decideHeader.bind(null, sampleRow))
      .join(" ");
    const mutationVariables = headers
      .map((header) => `${header}: $${header}`)
      .join(" ");

    const mutation = gql`
        mutation Create(${mutationFields}) {
          createUserProspect(${mutationVariables}) {
            data {
              id
            }
          }
        }
      `;

    await pipeline(
      fs.createReadStream(csvFilePath),
      specialExcelParsing,
      parse(csvOptions),
      async function* (source) {
        for await (const row of source as any) {
          const variables = headers.reduce((acc: any, header: string) => {
            if (row[header] === "true" || row[header] === "false") {
              acc[header] = row[header] === "true";
            } else {
              acc[header] = row[header];
            }
            return acc;
          }, {});

          const { data: updateUserProspectData } = await client.mutate({
            mutation,
            variables,
          });

          console.log("User prospect created:", updateUserProspectData);
        }
      },
    );
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

importScript().catch((err) => console.error(err));
