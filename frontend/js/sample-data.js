// Sample sections for working without the Flask server, and for the preview.
// None of this is real SDSU data. Sections 49 to 52 (CS 102, Fall 2026) are
// the overlapping pairs from the Phase 1 demo. Every row has a "term", the
// same column the sections table has.

const COURSES = {
  "CS 102":  ["Intro to Programming", 3],
  "CS 150":  ["Intro to Computer Programming", 3],
  "CS 160":  ["Intro to Computer Science", 3],
  "CS 210":  ["Data Structures", 3],
  "CS 310":  ["Data Structures II", 3],
  "CS 320":  ["Programming Languages", 3],
  "CS 370":  ["Computer Architecture", 3],
  "CS 450":  ["Intro to Artificial Intelligence", 3],
  "CS 470":  ["Unix System Administration", 3],
  "CS 514":  ["Database Theory & Implementation", 3],
  "MATH 151": ["Calculus I", 4],
  "MATH 245": ["Discrete Mathematics", 3],
  "MATH 252": ["Calculus III", 4],
  "MATH 254": ["Linear Algebra", 3],
  "STAT 250": ["Statistical Principles", 3],
  "PHYS 195": ["Principles of Physics", 3],
  "PHYS 196": ["Principles of Physics II", 3],
  "RWS 280":  ["Academic Reading and Writing", 3],
  "RWS 305W": ["Writing in Various Settings", 3],
  "HIST 109": ["American History I", 3],
  "PSY 101":  ["Intro to Psychology", 3],
  "ECON 102": ["Principles of Microeconomics", 3],
  "ART 157":  ["Art History Survey", 3],
  "BIOL 100": ["General Biology", 3],
};

// [id, course, section, first, last, days, start, end, building, room]
const ROWS = [
  [49, "CS 102", "C49", "Jordan", "Lee", "MW", "10:00", "11:15", "GMCS", "214"],
  [50, "CS 102", "C50", "Jordan", "Lee", "MW", "10:30", "11:45", "GMCS", "216"],
  [51, "CS 102", "C51", "Sam", "Rivera", "TTh", "13:00", "14:15", "GMCS", "325"],
  [52, "CS 102", "C52", "Sam", "Rivera", "TTh", "13:30", "14:45", "GMCS", "325"],
  [1, "CS 150", "01", "Alex", "Chen", "MWF", "08:00", "08:50", "GMCS", "308"],
  [2, "CS 150", "02", "Alex", "Chen", "TTh", "11:00", "12:15", "GMCS", "308"],
  [3, "CS 160", "01", "Dana", "Whitfield", "MW", "09:00", "10:15", "GMCS", "311"],
  [4, "CS 160", "02", "Dana", "Whitfield", "TTh", "14:00", "15:15", "GMCS", "311"],
  [5, "CS 160", "03", "Rafael", "Ortega", "MWF", "12:00", "12:50", "GMCS", "333"],
  [6, "CS 210", "01", "Priya", "Shah", "TTh", "09:30", "10:45", "GMCS", "311"],
  [7, "CS 210", "02", "Priya", "Shah", "MW", "14:00", "15:15", "GMCS", "405"],
  [8, "CS 210", "03", "Kenji", "Watanabe", "MW", "17:30", "18:45", "GMCS", "214"],
  [9, "CS 310", "01", "Priya", "Shah", "MW", "11:00", "12:15", "GMCS", "405"],
  [10, "CS 310", "02", "Kenji", "Watanabe", "TTh", "15:30", "16:45", "GMCS", "405"],
  [11, "CS 320", "01", "Morgan", "Diaz", "MW", "12:30", "13:45", "GMCS", "325"],
  [12, "CS 320", "02", "Morgan", "Diaz", "TTh", "17:00", "18:15", "GMCS", "325"],
  [13, "CS 370", "01", "Morgan", "Diaz", "TTh", "11:00", "12:15", "GMCS", "405"],
  [14, "CS 370", "02", "Elena", "Petrova", "MW", "15:30", "16:45", "GMCS", "422"],
  [15, "CS 450", "01", "Taylor", "Nguyen", "TTh", "15:30", "16:45", "GMCS", "333"],
  [16, "CS 450", "02", "Taylor", "Nguyen", "MW", "09:30", "10:45", "GMCS", "333"],
  [17, "CS 470", "01", "Chris", "Peterson", "MW", "16:00", "17:15", "GMCS", "422"],
  [18, "CS 470", "02", "Chris", "Peterson", "F", "09:00", "11:40", "GMCS", "422"],
  [19, "CS 514", "01", "Jamie", "Park", "MW", "17:30", "18:45", "GMCS", "422"],
  [20, "CS 514", "02", "Jamie", "Park", "TTh", "19:00", "20:15", "GMCS", "422"],
  [21, "MATH 151", "01", "Reese", "Kim", "MWF", "08:00", "08:50", "GMCS", "438"],
  [22, "MATH 151", "02", "Casey", "Morgan", "MWF", "11:00", "11:50", "GMCS", "438"],
  [23, "MATH 151", "03", "Casey", "Morgan", "TTh", "12:30", "14:20", "GMCS", "382"],
  [24, "MATH 245", "01", "Reese", "Kim", "TR", "10:00", "11:15", "GMCS", "382"],
  [25, "MATH 245", "02", "Reese", "Kim", "MW", "08:00", "09:15", "GMCS", "438"],
  [26, "MATH 245", "03", "Lina", "Haddad", "MW", "13:00", "14:15", "GMCS", "307"],
  [27, "MATH 252", "01", "Lina", "Haddad", "MWF", "10:00", "10:50", "GMCS", "307"],
  [28, "MATH 252", "02", "Owen", "Brennan", "TTh", "08:00", "09:50", "GMCS", "307"],
  [29, "MATH 254", "01", "Casey", "Morgan", "TR", "15:00", "16:15", "LOVE", "285"],
  [30, "MATH 254", "02", "Reese", "Kim", "MW", "12:00", "13:15", "GMCS", "382"],
  [31, "STAT 250", "01", "Owen", "Brennan", "TTh", "09:30", "10:45", "GMCS", "310"],
  [32, "STAT 250", "02", "Grace", "Liu", "MW", "15:00", "16:15", "GMCS", "310"],
  [33, "PHYS 195", "01", "Riley", "Patel", "MWF", "09:00", "09:50", "PS", "130"],
  [34, "PHYS 195", "02", "Riley", "Patel", "TTh", "12:30", "13:45", "PS", "130"],
  [35, "PHYS 196", "01", "Quinn", "Wilson", "MWF", "13:00", "13:50", "PS", "130"],
  [36, "PHYS 196", "02", "Quinn", "Wilson", "TTh", "08:00", "09:15", "PS", "130"],
  [37, "RWS 280", "01", "Avery", "Nguyen", "MW", "09:00", "10:15", "SH", "108"],
  [38, "RWS 280", "02", "Avery", "Nguyen", "TTh", "11:00", "12:15", "SH", "108"],
  [39, "RWS 280", "03", "Noelle", "Grant", "MW", "16:00", "17:15", "SH", "112"],
  [40, "RWS 305W", "01", "Noelle", "Grant", "TTh", "14:00", "15:15", "SH", "112"],
  [41, "RWS 305W", "02", "Isaac", "Romero", "MW", "11:00", "12:15", "SH", "108"],
  [42, "HIST 109", "01", "Jesse", "Morales", "MWF", "11:00", "11:50", "AH", "1112"],
  [43, "HIST 109", "02", "Jesse", "Morales", "TTh", "16:00", "17:15", "AH", "1112"],
  [44, "PSY 101", "01", "Hannah", "Cole", "MW", "13:00", "14:15", "LSN", "246"],
  [45, "PSY 101", "02", "Hannah", "Cole", "TTh", "09:30", "10:45", "LSN", "246"],
  [46, "PSY 101", "03", "Marcus", "Bell", "F", "13:00", "15:40", "LSN", "246"],
  [47, "ECON 102", "01", "Wei", "Zhang", "TTh", "12:30", "13:45", "EBA", "245"],
  [48, "ECON 102", "02", "Wei", "Zhang", "MW", "10:00", "11:15", "EBA", "245"],
  [53, "ART 157", "01", "Skyler", "Ortiz", "F", "10:00", "12:40", "ART", "200"],
  [54, "BIOL 100", "01", "Nadia", "Farouk", "MWF", "12:00", "12:50", "LS", "101"],
  [55, "BIOL 100", "02", "Nadia", "Farouk", "TTh", "17:00", "18:15", "LS", "101"],
];

// Spring 2027: the same courses with the meeting patterns swapped (MW <-> TTh),
// minus the CS 102 demo sections, so the two terms look different.
const SWAP = { MW: "TTh", TTh: "MW", TR: "MW" };
const SPRING_ROWS = ROWS
  .filter(([id]) => id < 49 || id > 52)
  .map(([id, course, sec, first, last, days, start, end, bldg, room]) =>
    [100 + id, course, sec, first, last, SWAP[days] || days, start, end, bldg, room]);

// Summer 2027: fewer courses, four days a week, longer blocks, one online class.
const SUMMER_ROWS = [
  [201, "CS 150", "S1", "Alex", "Chen", "MTWTh", "09:00", "10:50", "GMCS", "308"],
  [202, "CS 160", "S1", "Dana", "Whitfield", "MTWTh", "11:00", "12:50", "GMCS", "311"],
  [203, "CS 210", "S1", "Kenji", "Watanabe", "MTWTh", "13:00", "14:50", "GMCS", "214"],
  [204, "CS 210", "S2", "Priya", "Shah", "MTWTh", "09:00", "10:50", "GMCS", "405"],
  [205, "MATH 151", "S1", "Casey", "Morgan", "MTWTh", "08:00", "10:15", "GMCS", "438"],
  [206, "MATH 245", "S1", "Lina", "Haddad", "MTWTh", "10:30", "12:20", "GMCS", "307"],
  [207, "MATH 254", "S1", "Reese", "Kim", "MTWTh", "13:00", "14:50", "GMCS", "382"],
  [208, "STAT 250", "S1", "Grace", "Liu", "", "", "", "ONLINE", ""],
  [209, "PHYS 195", "S1", "Riley", "Patel", "MTWTh", "11:00", "12:50", "PS", "130"],
  [210, "RWS 280", "S1", "Avery", "Nguyen", "MTWTh", "09:00", "10:50", "SH", "108"],
  [211, "RWS 305W", "S1", "Noelle", "Grant", "MTWTh", "13:00", "14:50", "SH", "112"],
  [212, "HIST 109", "S1", "Jesse", "Morales", "MTWTh", "15:00", "16:50", "AH", "1112"],
  [213, "PSY 101", "S1", "Hannah", "Cole", "MTWTh", "11:00", "12:50", "LSN", "246"],
  [214, "ECON 102", "S1", "Wei", "Zhang", "MTWTh", "17:00", "18:50", "EBA", "245"],
];

const toRow = (term) => ([section_id, course, section_number, first_name, last_name, days, start_time, end_time, building, room_number]) => {
  const [subject, catalog_num] = course.split(" ");
  const [title, units] = COURSES[course];
  return { section_id, term, subject, catalog_num, title, units, section_number, first_name, last_name, days, start_time, end_time, building, room_number };
};

export const SAMPLE_SECTIONS = [
  ...ROWS.map(toRow("Fall 2026")),
  ...SPRING_ROWS.map(toRow("Spring 2027")),
  ...SUMMER_ROWS.map(toRow("Summer 2027")),
];
