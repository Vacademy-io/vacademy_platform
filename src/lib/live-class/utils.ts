export const calculateDuration = (startTime: string, lastEntryTime: string) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = lastEntryTime.split(":").map(Number);

  let durationMinutes =
    endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) {
    return `${minutes} minutes`;
  } else if (minutes === 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minutes`;
  }
};
