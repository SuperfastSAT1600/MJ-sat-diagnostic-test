const { initializeApp } = require("firebase/app");
const { getDatabase, ref, push, get, set, query, orderByChild, equalTo } = require("firebase/database");

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

// Firebase 데이터베이스 헬퍼 함수들
const firebaseDB = {
  // 데이터 저장
  async saveData(data) {
    try {
      const newRef = push(ref(database, 'diagnostic_results/'), data);
      console.log('Data saved to Firebase with key:', newRef.key);
      return newRef.key;
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      throw error;
    }
  },

  // 모든 데이터 조회
  async getAllData() {
    try {
      const snapshot = await get(ref(database, 'diagnostic_results/'));
      if (snapshot.exists()) {
        const data = [];
        snapshot.forEach((childSnapshot) => {
          data.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error reading from Firebase:', error);
      throw error;
    }
  },

  // ID로 데이터 조회 (Firebase 키 또는 기존 UUID)
  async getDataById(id) {
    try {
      // 먼저 Firebase 키로 직접 조회
      const snapshot = await get(ref(database, `diagnostic_results/${id}`));
      if (snapshot.exists()) {
        return {
          id: snapshot.key,
          ...snapshot.val()
        };
      }
      
      // Firebase 키로 찾지 못한 경우, originalId로 검색
      const q = query(
        ref(database, 'diagnostic_results/'),
        orderByChild('originalId'),
        equalTo(id)
      );
      const searchSnapshot = await get(q);
      if (searchSnapshot.exists()) {
        const data = [];
        searchSnapshot.forEach((childSnapshot) => {
          data.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return data[0]; // 첫 번째 결과 반환
      }
      
      return null;
    } catch (error) {
      console.error('Error reading from Firebase:', error);
      throw error;
    }
  },

  // 코드로 데이터 검색
  async searchByCode(code) {
    try {
      const q = query(
        ref(database, 'diagnostic_results/'),
        orderByChild('code'),
        equalTo(code)
      );
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const data = [];
        snapshot.forEach((childSnapshot) => {
          data.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
          });
        });
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error searching Firebase:', error);
      throw error;
    }
  },

  // 이름으로 데이터 검색
  async searchByName(name) {
    try {
      const q = query(
        ref(database, 'diagnostic_results/'),
        orderByChild('studentName')
      );
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const data = [];
        snapshot.forEach((childSnapshot) => {
          const studentName = childSnapshot.val().studentName;
          if (studentName && studentName.toLowerCase().includes(name.toLowerCase())) {
            data.push({
              id: childSnapshot.key,
              ...childSnapshot.val()
            });
          }
        });
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error searching Firebase:', error);
      throw error;
    }
  }
};

module.exports = { firebaseDB }; 