import { saveStudentData } from "./saveStudent.js";

const testStudent = {
  name: "홍길동",
  grade: "2학년",
  phone: "010-1234-5678"
};

saveStudentData(testStudent);
console.log("저장 완료!"); 