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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promises_1 = require("stream/promises");
const client_1 = require("@apollo/client");
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
            //columns: true,
            delimiter: process.env.CSV_DELIMITER,
            quote: process.env.CSV_QUOTE || "",
            escape: process.env.CSV_ESCAPE,
            skipLines: 0,
            headers: true,
            strict: true,
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
        try {
            const headers = yield new Promise((resolve, reject) => {
                const headerStream = fs_1.default
                    .createReadStream(csvFilePath)
                    .pipe(specialExcelParsing_1.default)
                    .pipe((0, csv_parse_1.parse)(Object.assign(Object.assign({}, csvOptions), { to_line: 1 })));
                headerStream.on("data", (header) => {
                    headerStream.pause();
                    resolve(header);
                });
                headerStream.on("error", (err) => {
                    headerStream.pause();
                    reject(err);
                });
            });
            console.log("headers", headers);
            const sampleRow = yield new Promise((resolve, reject) => {
                const rowStream = fs_1.default
                    .createReadStream(csvFilePath)
                    .pipe(specialExcelParsing_1.default)
                    .pipe((0, csv_parse_1.parse)(Object.assign(Object.assign({}, csvOptions), { to_line: 2, from_line: 2 })));
                rowStream.on("data", (row) => {
                    rowStream.pause();
                    resolve(row);
                });
                rowStream.on("error", (err) => {
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
            const mutation = (0, client_1.gql) `
        mutation Create(${mutationFields}) {
          createUserProspect(${mutationVariables}) {
            data {
              id
            }
          }
        }
      `;
            yield (0, promises_1.pipeline)(fs_1.default.createReadStream(csvFilePath), specialExcelParsing_1.default, (0, csv_parse_1.parse)(csvOptions), function (source) {
                return __asyncGenerator(this, arguments, function* () {
                    var _a, e_1, _b, _c;
                    try {
                        for (var _d = true, _e = __asyncValues(source), _f; _f = yield __await(_e.next()), _a = _f.done, !_a; _d = true) {
                            _c = _f.value;
                            _d = false;
                            const row = _c;
                            const variables = headers.reduce((acc, header) => {
                                if (row[header] === "true" || row[header] === "false") {
                                    acc[header] = row[header] === "true";
                                }
                                else {
                                    acc[header] = row[header];
                                }
                                return acc;
                            }, {});
                            const { data: updateUserProspectData } = yield __await(client.mutate({
                                mutation,
                                variables,
                            }));
                            console.log("User prospect created:", updateUserProspectData);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = _e.return)) yield __await(_b.call(_e));
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                });
            });
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
importScript().catch((err) => console.error(err));
