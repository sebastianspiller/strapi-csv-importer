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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authenticateUser;
function authenticateUser(email, password) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`${process.env.STRAPI_URL}/api/auth/local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                identifier: email, // E-Mail or Username
                password: password,
            }),
        });
        if (!response.ok) {
            const errorData = yield response.json();
            throw new Error(`Authentifizierung fehlgeschlagen: ${errorData.error.message}`);
        }
        const data = yield response.json();
        return data.jwt;
    });
}
