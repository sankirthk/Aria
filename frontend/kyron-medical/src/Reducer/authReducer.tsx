// import type { Reducer } from "react";

// export interface AuthState {
//   email: string;
//   password: string;
//   rePassword: string;
//   name: string;
//   inviteCode: string;
//   keepMeSignedIn: boolean;
//   showLogin: boolean;
//   forgotPassword: boolean;
//   inviteValidated: boolean;
//   loading: boolean;
//   emailError: string;
//   passwordError: string;
//   rePasswordError: string;
//   nameError: string;
//   codeError: string;
//   errorMessage: string;
//   successMessage: string;
// }

// export type AuthAction =
//   | { type: "SET_FIELD"; payload: { field: keyof AuthState; value: any } }
//   | { type: "SET_ERROR"; payload: { field: keyof AuthState; value: string } }
//   | { type: "SET_LOADING"; payload: boolean }
//   | { type: "SET_SUCCESS_MESSAGE"; payload: string }
//   | { type: "RESET_FORM" }
//   | {
//       type: "SET_MODE";
//       payload: Partial<
//         Pick<AuthState, "showLogin" | "forgotPassword" | "inviteValidated">
//       >;
//     };

// export const initialState: AuthState = {
//   email: "",
//   password: "",
//   rePassword: "",
//   name: "",
//   inviteCode: "",
//   keepMeSignedIn: false,
//   showLogin: true,
//   forgotPassword: false,
//   inviteValidated: false,
//   loading: false,
//   emailError: "",
//   passwordError: "",
//   rePasswordError: "",
//   nameError: "",
//   codeError: "",
//   errorMessage: "",
//   successMessage: "",
// };

// const authReducer: Reducer<AuthState, AuthAction> = (state, action) => {
//   switch (action.type) {
//     case "SET_FIELD":
//       return {
//         ...state,
//         [action.payload.field]: action.payload.value,
//       };
//     case "SET_ERROR":
//       return {
//         ...state,
//         [action.payload.field]: action.payload.value,
//       };
//     case "SET_LOADING":
//       return {
//         ...state,
//         loading: action.payload,
//       };
//     case "SET_SUCCESS_MESSAGE":
//       return {
//         ...state,
//         successMessage: action.payload,
//       };
//     case "RESET_FORM":
//       return {
//         ...state,
//         email: "",
//         password: "",
//         rePassword: "",
//         name: "",
//         inviteCode: "",
//         keepMeSignedIn: false,
//         emailError: "",
//         passwordError: "",
//         rePasswordError: "",
//         nameError: "",
//         codeError: "",
//         errorMessage: "",
//         successMessage: "",
//         loading: false,
//       };
//     case "SET_MODE":
//       return {
//         ...state,
//         ...action.payload,
//         errorMessage: "",
//         successMessage: "",
//         emailError: "",
//         passwordError: "",
//         rePasswordError: "",
//         nameError: "",
//         codeError: "",
//         loading: false,
//       };
//     default:
//       return state;
//   }
// };

// export default authReducer;
