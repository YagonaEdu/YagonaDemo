import { status } from "./admin";
import { common, format, languageNames, plural } from "./common";
import { login, roles } from "./login";
import { shell, ui, week } from "./shell";
import { tch } from "./teacher";
import { tResults, tStudents } from "./teacherStudents";
import { tAsg } from "./teacherAssignments";
import { tAtt, tCreate } from "./teacherAttendance";
import { tGd, tSd } from "./teacherDrawers";
import { tMat } from "./teacherMaterials";
import { tNotif, tProfile } from "./teacherProfile";
import { tDialogs, tGroups, tHome, tSchedule } from "./teacherHome";
import { aRec, aRecU, aPsf, aSqc, aMark, aNvs, aQps, aQss, aTasks, aTd, aTdp, aTls, aTrials, aTeach, aDash, aSet, aCrm } from "./reception";
import { rxDash, rxSet, rxSheet, rxShell, rxTasks, rxTrials } from "./receptionFigma";
import { owDash, owFin, owStaff, owSet } from "./owner";
import { aStu, aCrs, aGrp, aRooms, aRoomD, aNss, aSch, aAtt, aBill, aNtf } from "./adminPages";

export const MESSAGES = {
  owSet,
  owStaff,
  owFin,
  owDash,
  rxShell,
  rxDash,
  rxSheet,
  rxSet,
  rxTasks,
  rxTrials,
  aNtf,
  aBill,
  aAtt,
  aSch,
  aNss,
  aRoomD,
  aRooms,
  aGrp,
  aCrs,
  aStu,
  aCrm,
  aSet,
  aDash,
  aTeach,
  aTrials,
  aTls,
  aTdp,
  aTd,
  aTasks,
  aQss,
  aQps,
  aNvs,
  aRec,
  aMark,
  aSqc,
  aPsf,
  aRecU,
  status,
  format,
  common,
  plural,
  languageNames,
  login,
  roles,
  ui,
  week,
  shell,
  tch,
  tStudents,
  tResults,
  tHome,
  tGroups,
  tSchedule,
  tDialogs,
  tAsg,
  tAtt,
  tCreate,
  tGd,
  tSd,
  tMat,
  tNotif,
  tProfile,
};
