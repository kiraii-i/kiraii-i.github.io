// ============================================================
//  artshop/ — settings
//  Password is NOT stored here (this file is public on GitHub).
//  The password lives in Firebase Authentication only.
// ============================================================
export const CONFIG = {
  // The owner account. Always has full access to the dashboard.
  ownerEmail: "kiraiii.002@gmail.com",

  currency: "EGP",

  // Paste your Firebase web-app config here (see README.md, step 2).
  // While it is null the site runs in DEMO MODE (data saved in this browser only).
  firebase: null,
  /* example:
  firebase: {
    apiKey: "AIza...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    appId: "1:123:web:abc"
  },
  */

  // Easiest way to get every order by email (no sign-up): FormSubmit.
  // The first real order sends you ONE activation email — click the link in it. Then you can
  // replace the address below with the secret alias FormSubmit gives you (so bots can't spam you).
  formsubmit: "kiraiii.002@gmail.com",

  // Optional alternative: EmailJS (see README.md, step 3). If filled, it is used instead of FormSubmit.
  // Email notification for every new order / custom request (see README.md, step 3).
  // Leave empty to skip emails — orders still appear in the dashboard.
  emailjs: {
    serviceId: "",
    templateId: "",
    publicKey: ""
  }
};
