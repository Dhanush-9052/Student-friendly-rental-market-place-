// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6XDya6MjoVPLNSDsEE4JlpLcKAJsFIrw",
  authDomain: "student-rental-hub.firebaseapp.com",
  projectId: "student-rental-hub",
  storageBucket: "student-rental-hub.appspot.com",
  messagingSenderId: "90362972178",
  appId: "1:90362972178:web:2454cdc265537aac4c70cb"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);