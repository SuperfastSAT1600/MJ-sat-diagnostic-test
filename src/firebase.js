import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCdxGGYeVlFiTTYk2m8_p7-H5mpy5IdjoU",
  authDomain: "sfs-diagnostictest.firebaseapp.com",
  databaseURL: "https://sfs-diagnostictest-default-rtdb.firebaseio.com",
  projectId: "sfs-diagnostictest",
  storageBucket: "sfs-diagnostictest.firebasestorage.app",
  messagingSenderId: "719185200332",
  appId: "1:719185200332:web:41babe0142d1381c58ae69",
  measurementId: "G-2V7P0G674Q"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database }; 