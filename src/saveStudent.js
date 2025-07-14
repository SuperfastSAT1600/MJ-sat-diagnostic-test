import { ref, push } from "firebase/database";
import { database } from "./firebase.js";

// 학생 정보를 저장하는 함수
export function saveStudentData(student) {
  push(ref(database, 'students/'), student);
} 