import { MATCH_STATUS } from "../validation/matches.js";

export function getMatchStatus(startTime, endTime, now = new Date()) {
  const start = new Date(startTime);

  // since endTime is nullable in the schema, giving Date(null) or Date(undefined) can result in unexpected behavior, so we are checking it in <other way>

  // const end = new Date(endTime);

  // if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
  //     return null;
  // }

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  // <other way>
  // If no endTime, match is live once started
  if (endTime == null) {
    return MATCH_STATUS.LIVE;
  }

  const end = new Date(endTime);
  if (Number.isNaN(end.getTime())) {
    return MATCH_STATUS.LIVE;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(match, updateStatus) {
  const nextStatus = getMatchStatus(match.startTime, match.endTime);
  if (!nextStatus) {
    return match.status;
  }
  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }
  return match.status;
}
