import { MATCH_STATUS, MatchStatus } from "../validation/matches";

export function getMatchStatus(
  startTime: string | Date,
  endTime: string | Date,
  now: Date = new Date(),
): MatchStatus | null {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  if (now < start) {
    return "scheduled";
  }

  if (now >= end) {
    return "finished";
  }

  return "live";
}

export async function syncMatchStatus(
  match: { status: string; startTime: string | Date; endTime: string | Date },
  updateStatus: (status: string) => Promise<void>,
): Promise<string> {
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
