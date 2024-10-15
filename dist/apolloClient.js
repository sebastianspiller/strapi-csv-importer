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
exports.default = createApolloClient;
const client_1 = require("@apollo/client");
const authenticateUser_1 = __importDefault(require("./authenticateUser"));
const cross_fetch_1 = __importDefault(require("cross-fetch"));
/**
 * Creates an Apollo Client with the given email and password.
 * If no email and password are provided, the client will be created without authentication.
 * @param {string | undefined} email - The email of the user.
 * @param {string | undefined} password - The password of the user.
 * @returns {ApolloClient<InMemoryCache>} The Apollo Client.
 */
function createApolloClient() {
    return __awaiter(this, arguments, void 0, function* (email = "", password = "") {
        let jwtToken;
        let headers = {};
        if (email && password) {
            jwtToken = yield (0, authenticateUser_1.default)(email, password);
            headers = {
                Authorization: `Bearer ${jwtToken}`,
            };
        }
        return new client_1.ApolloClient({
            ssrMode: true,
            link: new client_1.HttpLink({
                uri: `${process.env.STRAPI_URL}/graphql`,
                headers: headers,
                fetch: cross_fetch_1.default,
            }),
            cache: new client_1.InMemoryCache(),
        });
    });
}
