// js/firebase-init.js

// 1. SET UP FIREBASE CONFIGURATION
// You must replace the text below with your OWN keys from the Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyDkeRPtQtq4UY5zu_F4-UlkIHdMw5VW57Q",
  authDomain: "medelife-v2.firebaseapp.com",
  projectId: "medelife-v2",
  storageBucket: "medelife-v2.firebasestorage.app",
  messagingSenderId: "68690670212",
  appId: "1:68690670212:web:be822816de83dde36b88d1",
  measurementId: "G-N2DVL3ZWB2"
};

// 2. INITIALIZE FIREBASE
// This starts the connection
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that one
}
