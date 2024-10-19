"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const apolloClient_1 = __importDefault(require("./apolloClient"));
const specialExcelParsing_1 = __importDefault(require("./specialExcelParsing"));
const dotenv_1 = __importDefault(require("dotenv"));
const csv_parse_1 = require("csv-parse");
function importScript() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Importing CSV file...");
        dotenv_1.default.config();
        if (!process.env.STRAPI_EMAIL || !process.env.STRAPI_PASSWORD) {
            throw new Error("STRAPI_EMAIL or STRAPI_PASSWORD not set.");
        }
        const client = yield (0, apolloClient_1.default)(process.env.STRAPI_EMAIL, process.env.STRAPI_PASSWORD);
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
        const csvDir = path_1.default.join(__dirname, "..", "csv");
        const csvFiles = fs_1.default
            .readdirSync(csvDir)
            .filter((file) => file.endsWith(".csv"));
        if (csvFiles.length === 0) {
            throw new Error("No CSV-File found in the directory.");
        }
        if (csvFiles.length > 1) {
            throw new Error("Found more than 1 CSV file in the directory.");
        }
        const csvFilePath = path_1.default.join(csvDir, csvFiles[0]);
        let headers = [];
        let rows = [];
        try {
            rows = yield new Promise((resolve, reject) => {
                const rowStream = fs_1.default
                    .createReadStream(csvFilePath)
                    .pipe(specialExcelParsing_1.default)
                    .pipe((0, csv_parse_1.parse)(csvOptions));
                const allRows = [];
                let isFirstRow = true;
                rowStream.on("data", (row) => {
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
                rowStream.on("error", (err) => {
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
            const jsonData = {
                version: 2,
                data: {
                    [`api::${collectionName}.${collectionName}`]: {},
                },
            };
            rows.forEach((row, index) => {
                const rowData = {};
                headers.forEach((header, headerIndex) => {
                    const snake_case_header = camelToSnake(header);
                    rowData[snake_case_header] = changeIfRichtext(header, row[headerIndex].trim());
                });
                jsonData.data[`api::${collectionName}.${collectionName}`][index + 1] = Object.assign(Object.assign({ id: index + 1 }, rowData), { publishedAt: new Date().toISOString() });
            });
            // Save the json data in a json file in out directory:
            const outputDir = path_1.default.join(__dirname, "..", "out");
            if (!fs_1.default.existsSync(outputDir)) {
                fs_1.default.mkdirSync(outputDir);
            }
            const outputFilePath = path_1.default.join(outputDir, "importData.json");
            fs_1.default.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2));
            console.log("Import completed.");
        }
        catch (error) {
            console.error("Error while importing the CSV file:", error);
        }
    });
}
/**
 * If it's a string, set GraphQL type to String, ...
 * @param header Header (Column) of the CSV file.
 */
function decideHeader(sampleRow, header) {
    const value = sampleRow[header];
    if (value === "true" || value === "false") {
        return `$${header}: Boolean`;
    }
    else if (typeof value === "string") {
        return `$${header}: String`;
    }
    else if (typeof value === "number") {
        return `$${header}: Float`;
    }
    else {
        throw new Error(`Unsupported data type for header: ${header}`);
    }
}
/**
 * Function: Switch CamelCase to snake_case
 */
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function changeIfRichtext(header, value) {
    var _a, _b;
    // get header from process.env.RICH_TEXT_FIELDS (comma separated):
    const richTextFields = (_b = (_a = process.env.RICH_TEXT_FIELDS) === null || _a === void 0 ? void 0 : _a.split(",")) !== null && _b !== void 0 ? _b : [];
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
