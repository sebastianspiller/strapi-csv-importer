import fs from "fs";
import path from "path";
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

  console.log("Client created successfully.");

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

  try {
    const headers: string[] = [];
    const rows: string[][] = [];
    let isFirstRow = true;

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(specialExcelParsing)
        .pipe(parse(csvOptions))
        .on("data", (row: string[]) => {
          if (isFirstRow) {
            headers.push(...row);
            isFirstRow = false;
          } else {
            rows.push(row);
          }
        })
        .on("error", (err: Error) => {
          reject(err);
        })
        .on("end", () => {
          resolve();
        });
    });

    const mutationFields = headers
      .map(header => decideHeader(rows[0], header))
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

    const processRow = (headers: string[]) => (row: any) => {
      return headers.reduce((acc: any, header: string) => {
        if (row[header] === undefined) {
          console.log(`Warning: ${header} is undefined`);
          acc[header] = null; // or some default value
        } else if (row[header] === "true" || row[header] === "false") {
          acc[header] = row[header] === "true";
        } else {
          acc[header] = row[header];
        }
        return acc;
      }, {});
    };

    const createUserProspect = async (client: any, mutation: any, variables: any) => {
      try {
        const { data: updateUserProspectData } = await client.mutate({
          mutation,
          variables,
        });
        console.log("User prospect created:", updateUserProspectData);
        return updateUserProspectData;
      } catch (error) {
        console.error("Error creating user prospect:", error);
        throw error;
      }
    };

    for (const row of rows) {
      const variables = processRow(headers)(row);
      try {
        await createUserProspect(client, mutation, variables);
 
        // Decide whether to continue with the next row or stop the process
        // If you want to stop on first error, you can add a `break;` here
      } catch (error) {
        console.error("Error creating user prospect:", error);
        throw error;
      }
    }

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
  } else if (typeof value === "string" || value === null || value === undefined) {
    return `$${header}: String`;
  } else if (typeof value === "number") {
    return `$${header}: Float`;
  } else {
    console.warn(`Unsupported data type for header: ${header}. Defaulting to String.`);
    return `$${header}: String`;
  }
}

importScript().catch((err) => console.error(err));
